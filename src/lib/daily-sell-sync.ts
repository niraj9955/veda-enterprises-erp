// ─────────────────────────────────────────────────────────────────────────────
// Daily Sell → Auto-Sync Engine
// ─────────────────────────────────────────────────────────────────────────────
// When a Daily Sell entry is created/updated/deleted, this module mirrors the
// change into the Customer, Order, Customer Payment, Payment, and (when
// transporter info is present) Tractor Payment collections so the user only
// has to enter data ONCE.
//
// Sync targets:
//   1. Customer          — find-or-create by mobile (preferred) or name.
//                          If found, update address if it changed.
//   2. Order             — create a new Order with one line item matching
//                          the sold product. Linked via `orderId` on DailySell.
//   3. CustomerPayment   — create a receivable entry for the sale amount.
//                          Linked via `customerPaymentId` on DailySell.
//                          (Finance → Customer Payment module)
//   4. Payment           — create a receivable entry with customerId +
//                          paymentType so it appears in the Management →
//                          Payments module's outstanding calculation.
//                          Linked via `paymentId` on DailySell.
//   5. TractorPayment    — ONLY when transporterName + transporterFair > 0.
//                          Logs the freight as an outstanding transporter
//                          payment (type = 'transporter'). Linked via
//                          `tractorPaymentId` on DailySell.
//                          (Finance → Tractor Payment module)
//   6. Stock             — NOT written directly. Stock availability is
//                          computed dynamically by /api/stock/summary as
//                          (Total Production − Total Sold), so creating a
//                          DailySell already updates "available stock" by
//                          design. We just record this fact in syncNotes.
//
// On PUT (edit): we delete the previously-linked Order + CustomerPayment +
// Payment + TractorPayment and recreate them with the new data. The Customer
// record is preserved (it may have other transactions) but its address is
// updated if changed.
//
// On DELETE: we delete the linked Order + CustomerPayment + Payment +
// TractorPayment. The Customer record is preserved (same reason).
//
// All sync operations are BEST-EFFORT — if one fails, we log the error and
// continue with the others, and surface the partial-failure in `syncNotes`
// so the user knows what didn't sync.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose'
import { Customer, Order, CustomerPayment, Payment, TractorPayment, Company } from '@/lib/models'

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
  receivedAmount?: number
  pendingAmount?: number
  remarks?: string
  // Used by syncTractorPayment to set linkedDailySellId back on the
  // mirrored TractorPayment record so future PUT/DELETE on the parent
  // DailySell can find and clean it up.
  dailySellId?: string
}

export interface SyncResult {
  customerId: string | null
  orderId: string | null
  orderNumber?: string
  customerPaymentId: string | null
  paymentId: string | null
  tractorPaymentId: string | null
  syncNotes: string
}

export interface ExistingLinks {
  customerId?: string | null
  orderId?: string | null
  customerPaymentId?: string | null
  paymentId?: string | null
  tractorPaymentId?: string | null
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
// Records the RECEIVED amount (what the customer actually paid for this sale)
// in the Customer Payment module. If the sale is partially paid or unpaid,
// the pending balance is noted in the remarks so the user can see at a glance
// how much is still outstanding.

export async function syncCustomerPayment(
  input: DailySellInput
): Promise<{ customerPaymentId: string | null; note: string }> {
  try {
    const name = (input.customerName || '').trim()
    if (!name) {
      return { customerPaymentId: null, note: 'CustomerPayment skipped (no name)' }
    }

    const product = (input.product || '').trim()
    const totalAmount = Number(input.amount) || 0
    const received = Number(input.receivedAmount) || 0
    const pending = Math.max(0, totalAmount - received)

    // Build a descriptive remark so the user can trace this payment back to
    // the source Daily Sell entry even when looking at Customer Payment alone.
    const remarkParts: string[] = [`Auto from Daily Sell${product ? ` — ${product}` : ''}`]
    if (input.transporterName) remarkParts.push(`Transporter: ${input.transporterName}`)
    if (pending > 0) {
      remarkParts.push(`Pending: ₹${pending}`)
    } else if (received > 0) {
      remarkParts.push('Fully paid')
    }
    const remarks = remarkParts.join(' · ')

    const record = await CustomerPayment.create({
      date: input.date,
      name,
      address: (input.address || '').trim(),
      amount: received, // ← what was actually received, NOT the total sale
      remarks,
    })

    return {
      customerPaymentId: record._id.toString(),
      note: `CustomerPayment ₹${received}${pending > 0 ? ` (pending ₹${pending})` : ''}`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] CustomerPayment sync failed:', err)
    return { customerPaymentId: null, note: 'CustomerPayment sync failed' }
  }
}

// ── 4. Payment sync (Management → Payments module) ──────────────────────────
// Creates a Payment record (NOT CustomerPayment — the OTHER collection) so the
// sale's received amount shows up in the Management → Payments module and is
// included in the outstanding-customer calculation there. Without this, daily
// sell entries would never appear in the Management payments list, even though
// the customer paid us — that's exactly the bug the user reported.
//
// The Payment mirrors into CustomerPayment via the existing
// payment-customer-sync helper, but to keep coupling low we create both
// records directly here (the daily-sell path is the source of truth, so it
// should own both mirrors). The Payment.customerPaymentId field is set to
// the SAME CustomerPayment._id we just created above, so the two stay linked
// and a future PUT/DELETE on the Payment side won't double-create mirrors.

export async function syncPayment(
  input: DailySellInput,
  customerId: string | null,
  customerPaymentId: string | null
): Promise<{ paymentId: string | null; note: string }> {
  try {
    if (!customerId) {
      return { paymentId: null, note: 'Payment skipped (no customer)' }
    }
    const received = Number(input.receivedAmount) || 0
    const product = (input.product || '').trim()

    // We only create a Payment record when money was actually received.
    // For zero-received sales (full pending), there's nothing to record in
    // the Payments module — the outstanding amount shows up via the Order
    // total in the outstanding calculation.
    if (received <= 0) {
      return { paymentId: null, note: 'Payment skipped (₹0 received)' }
    }

    const remarkParts: string[] = [`Auto from Daily Sell${product ? ` — ${product}` : ''}`]
    if (input.transporterName) remarkParts.push(`Transporter: ${input.transporterName}`)
    const remarks = remarkParts.join(' · ')

    const payment = await Payment.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      paymentType: 'Cash', // default — user can change later in Payments module
      amount: received,
      date: input.date,
      remarks,
      billId: null,
      billNumber: '',
      // Link back to the CustomerPayment mirror created moments ago. This
      // prevents the payment-customer-sync helper from re-creating a second
      // mirror when /api/payments/[id] is later edited.
      customerPaymentId: customerPaymentId
        ? new mongoose.Types.ObjectId(customerPaymentId)
        : null,
    })

    return {
      paymentId: payment._id.toString(),
      note: `Payment ₹${received} (Management)`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] Payment sync failed:', err)
    return { paymentId: null, note: 'Payment sync failed' }
  }
}

// ── 5. Tractor Payment sync (Finance → Tractor Payment, type=transporter) ────
// When the daily sell has a transporterName AND a non-zero transporterFair,
// we log the freight charge as an outstanding transporter payment under the
// Tractor Payment module (type = 'transporter'). This makes the Tractor
// Payment module a single pane of glass for ALL vendor payments: tractor
// raw-material purchases AND transporter freight charges.
//
// The TractorPayment.linkedDailySellId field is set so future PUT/DELETE on
// the parent DailySell can find and clean it up.

export async function syncTractorPayment(
  input: DailySellInput,
  dailySellId?: string
): Promise<{ tractorPaymentId: string | null; note: string }> {
  try {
    const vendorName = (input.transporterName || '').trim()
    const fair = Number(input.transporterFair) || 0

    // No transporter info → nothing to log.
    if (!vendorName || fair <= 0) {
      return { tractorPaymentId: null, note: 'TractorPayment skipped (no transporter)' }
    }

    const product = (input.product || '').trim()
    const remarkParts: string[] = [`Auto from Daily Sell${product ? ` — ${product}` : ''}`]
    if (input.customerName) remarkParts.push(`Customer: ${input.customerName}`)
    const remarks = remarkParts.join(' · ')

    const record = await TractorPayment.create({
      date: input.date,
      vendorName,
      quantityTon: 0, // freight-only entry — no tonnage
      rate: fair,
      totalAmount: fair,
      paidAmount: 0, // assumed unpaid — user reconciles manually
      remainingAmount: fair,
      remarks,
      type: 'transporter',
      linkedDailySellId: dailySellId ? new mongoose.Types.ObjectId(dailySellId) : null,
    })

    return {
      tractorPaymentId: record._id.toString(),
      note: `Transporter ₹${fair} (${vendorName})`,
    }
  } catch (err) {
    console.error('[daily-sell-sync] TractorPayment sync failed:', err)
    return { tractorPaymentId: null, note: 'TractorPayment sync failed' }
  }
}

// ── Orchestrator — run all syncs and assemble syncNotes ────────────────────────

export async function syncAllFromDailySell(
  input: DailySellInput
): Promise<SyncResult> {
  const customerRes = await syncCustomer(input)
  const orderRes = await syncOrder(input, customerRes.customerId)
  const paymentCpRes = await syncCustomerPayment(input)
  const paymentRes = await syncPayment(
    input,
    customerRes.customerId,
    paymentCpRes.customerPaymentId
  )
  const tractorRes = await syncTractorPayment(input, input.dailySellId)

  const notes: string[] = [
    customerRes.note,
    orderRes.note,
    paymentCpRes.note,
    paymentRes.note,
    tractorRes.note,
  ]
  // Stock availability is auto-recalculated by /api/stock/summary
  notes.push('Stock auto-updated (Production − Sold)')

  return {
    customerId: customerRes.customerId,
    orderId: orderRes.orderId,
    orderNumber: orderRes.orderNumber,
    customerPaymentId: paymentCpRes.customerPaymentId,
    paymentId: paymentRes.paymentId,
    tractorPaymentId: tractorRes.tractorPaymentId,
    syncNotes: notes.join(' · '),
  }
}

// ── Cleanup — used by PUT (before re-sync) and DELETE ────────────────────────
// Deletes the linked Order + CustomerPayment + Payment + TractorPayment.
// Preserves the Customer record (it may have other transactions). Returns a
// note describing what was cleaned.

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
      notes.push('Old customer payment removed')
    } catch (err) {
      console.error('[daily-sell-sync] CustomerPayment cleanup failed:', err)
      notes.push('Old customer payment cleanup failed')
    }
  }

  if (links.paymentId) {
    try {
      await Payment.findByIdAndDelete(links.paymentId)
      notes.push('Old payment removed')
    } catch (err) {
      console.error('[daily-sell-sync] Payment cleanup failed:', err)
      notes.push('Old payment cleanup failed')
    }
  }

  if (links.tractorPaymentId) {
    try {
      await TractorPayment.findByIdAndDelete(links.tractorPaymentId)
      notes.push('Old transporter payment removed')
    } catch (err) {
      console.error('[daily-sell-sync] TractorPayment cleanup failed:', err)
      notes.push('Old transporter payment cleanup failed')
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
