// ─────────────────────────────────────────────────────────────────────────────
// Daily Sell → Auto-Sync Engine
// ─────────────────────────────────────────────────────────────────────────────
// When a Daily Sell entry is created/updated/deleted, this module mirrors the
// change into the Customer, Order, and Customer Payment collections so the
// user only has to enter data ONCE.
//
// Sync targets:
//   1. Customer          — find-or-create by mobile (preferred) or name.
//                          If found, update address if it changed.
//   2. Order             — create a new Order with one line item matching
//                          the sold product. Linked via `orderId` on DailySell.
//   3. CustomerPayment   — create a receivable entry for the sale amount.
//                          Linked via `customerPaymentId` on DailySell.
//   4. Stock             — NOT written directly. Stock availability is
//                          computed dynamically by /api/stock/summary as
//                          (Total Production − Total Sold), so creating a
//                          DailySell already updates "available stock" by
//                          design. We just record this fact in syncNotes.
//
// On PUT (edit): we delete the previously-linked Order + CustomerPayment
// and recreate them with the new data. The Customer record is preserved
// (it may have other transactions) but its address is updated if changed.
//
// On DELETE: we delete the linked Order + CustomerPayment. The Customer
// record is preserved (same reason).
//
// All sync operations are BEST-EFFORT — if one fails, we log the error and
// continue with the others, and surface the partial-failure in `syncNotes`
// so the user knows what didn't sync.
// ─────────────────────────────────────────────────────────────────────────────

import { Customer, Order, CustomerPayment, Company } from '@/lib/models'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailySellInput {
  date: string
  customerName: string
  address?: string
  contactNumber?: string
  product?: string
  quantity?: number
  rate?: number
  amount: number
  transporterName?: string
  transporterFair?: number
  remarks?: string
}

export interface SyncResult {
  customerId: string | null
  orderId: string | null
  orderNumber?: string
  customerPaymentId: string | null
  syncNotes: string
}

export interface ExistingLinks {
  customerId?: string | null
  orderId?: string | null
  customerPaymentId?: string | null
}

// ── 1. Customer sync ────────────────────────────────────────────────────────

export async function syncCustomer(input: DailySellInput): Promise<{ customerId: string | null; note: string }> {
  const name = (input.customerName || '').trim()
  const mobile = (input.contactNumber || '').trim()
  const address = (input.address || '').trim()

  if (!name) {
    return { customerId: null, note: 'Customer skipped (no name)' }
  }

  try {
    // Step 1: try to match by mobile (most reliable identity)
    let customer: any = null
    if (mobile) {
      customer = await Customer.findOne({ mobile }).lean()
    }
    // Step 2: fallback to case-insensitive name match
    if (!customer) {
      customer = await Customer.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).lean()
    }

    if (customer) {
      // Update address if it changed (and a new address was provided)
      if (address && address !== (customer.address || '')) {
        await Customer.findByIdAndUpdate(customer._id, { address })
      }
      // Also update mobile if the existing one is placeholder and we have a real one now
      if (mobile && (!customer.mobile || customer.mobile.startsWith('N/A-'))) {
        await Customer.findByIdAndUpdate(customer._id, { mobile })
      }
      return {
        customerId: customer._id.toString(),
        note: `Customer linked (${customer.name})`,
      }
    }

    // Step 3: create a new customer. mobile is required by schema — if the
    // user didn't provide one, use a placeholder so we don't block the sync.
    const effectiveMobile = mobile || `N/A-${Date.now()}`
    const created = await Customer.create({
      name,
      mobile: effectiveMobile,
      address,
      gstNumber: '',
      creditLimit: 0,
    })
    return {
      customerId: created._id.toString(),
      note: `Customer created (${name})`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] Customer sync failed:', err)
    return { customerId: null, note: 'Customer sync failed' }
  }
}

// ── 2. Order sync ────────────────────────────────────────────────────────────

export async function syncOrder(
  input: DailySellInput,
  customerId: string | null
): Promise<{ orderId: string | null; orderNumber?: string; note: string }> {
  if (!customerId) {
    return { orderId: null, note: 'Order skipped (no customer)' }
  }

  try {
    const count = await Order.countDocuments({})
    const company = await Company.findOne({})
    const prefix = company?.orderPrefix || 'ORD'
    const orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

    const product = (input.product || '').trim() || 'Item'
    const quantity = Number(input.quantity) || 0
    const rate = Number(input.rate) || 0
    const amount = Number(input.amount) || quantity * rate

    const order = await Order.create({
      orderNumber,
      customerId,
      brickType: product,
      quantity,
      rate,
      amount,
      items: [
        {
          description: product,
          hsn: '',
          quantity,
          unit: 'pcs',
          rate,
          amount,
        },
      ],
      deliveryDate: input.date,
      status: 'Pending',
    })

    return {
      orderId: order._id.toString(),
      orderNumber,
      note: `Order ${orderNumber} created`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] Order sync failed:', err)
    return { orderId: null, note: 'Order sync failed' }
  }
}

// ── 3. Customer Payment sync ─────────────────────────────────────────────────

export async function syncCustomerPayment(
  input: DailySellInput
): Promise<{ customerPaymentId: string | null; note: string }> {
  try {
    const name = (input.customerName || '').trim()
    if (!name) {
      return { customerPaymentId: null, note: 'Payment skipped (no name)' }
    }

    const product = (input.product || '').trim()
    const amount = Number(input.amount) || 0
    const remarks = `Auto from Daily Sell${product ? ` — ${product}` : ''}${input.transporterName ? ` · Transporter: ${input.transporterName}` : ''}`

    const record = await CustomerPayment.create({
      date: input.date,
      name,
      address: (input.address || '').trim(),
      amount,
      remarks,
    })

    return {
      customerPaymentId: record._id.toString(),
      note: `Payment recorded (₹${amount})`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] CustomerPayment sync failed:', err)
    return { customerPaymentId: null, note: 'Payment sync failed' }
  }
}

// ── Orchestrator — run all three syncs and assemble syncNotes ────────────────

export async function syncAllFromDailySell(
  input: DailySellInput
): Promise<SyncResult> {
  const customerRes = await syncCustomer(input)
  const orderRes = await syncOrder(input, customerRes.customerId)
  const paymentRes = await syncCustomerPayment(input)

  const notes: string[] = [customerRes.note, orderRes.note, paymentRes.note]
  // Stock availability is auto-recalculated by /api/stock/summary
  notes.push('Stock auto-updated (Production − Sold)')

  return {
    customerId: customerRes.customerId,
    orderId: orderRes.orderId,
    orderNumber: orderRes.orderNumber,
    customerPaymentId: paymentRes.customerPaymentId,
    syncNotes: notes.join(' · '),
  }
}

// ── Cleanup — used by PUT (before re-sync) and DELETE ────────────────────────
// Deletes the linked Order + CustomerPayment. Preserves the Customer record
// (it may have other transactions). Returns a note describing what was cleaned.

export async function cleanupDailySellLinks(links: ExistingLinks): Promise<string> {
  const notes: string[] = []

  if (links.orderId) {
    try {
      await Order.findByIdAndDelete(links.orderId)
      notes.push('Old order removed')
    } catch (err) {
      console.error('[daily-sell-sync] Order cleanup failed:', err)
      notes.push('Old order cleanup failed')
    }
  }

  if (links.customerPaymentId) {
    try {
      await CustomerPayment.findByIdAndDelete(links.customerPaymentId)
      notes.push('Old payment removed')
    } catch (err) {
      console.error('[daily-sell-sync] CustomerPayment cleanup failed:', err)
      notes.push('Old payment cleanup failed')
    }
  }

  // Customer is intentionally NOT deleted — they may have other orders,
  // payments, dispatches, or bills linked to them. The user can manually
  // delete the customer from the Customers module if truly unused.

  return notes.join(' · ')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
