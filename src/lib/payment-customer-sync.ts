// ─────────────────────────────────────────────────────────────────────────────
// Payment ↔ CustomerPayment sync helper
//
// The ERP has TWO payment collections that both represent "customer gave us
// money":
//
//   • Payment           (Management → Payments module)
//       - linked to a Customer via customerId (ObjectId)
//       - linked to an optional Bill via billId
//       - has paymentType (cash / upi / cheque / etc.)
//
//   • CustomerPayment   (Customer section → Customer Payment module)
//       - flat record: { date, name, address, amount, remarks }
//       - name is a free-text customer name string
//
// The user wants ANY change in the Management → Payments module to also be
// reflected in the Customer Payment module, so they always see ONE unified
// list of customer payments regardless of which side they entered it on.
//
// Strategy: every Payment carries an optional `customerPaymentId` field
// pointing to its mirror CustomerPayment record. When a Payment is:
//   • created  → we create a matching CustomerPayment and store its _id back
//                on the Payment.
//   • updated  → we update the linked CustomerPayment in place. If the
//                customer changed, we re-resolve the new customer's name.
//   • deleted  → we delete the linked CustomerPayment.
//
// All sync operations are best-effort: a sync failure is logged but NEVER
// fails the parent Payment operation, so the user's primary workflow is
// never blocked by a secondary sync issue.
// ─────────────────────────────────────────────────────────────────────────────

import { connectDB } from '@/lib/db'
import { Customer, CustomerPayment, Payment } from '@/lib/models'
import type { Types } from 'mongoose'

/**
 * Resolve a customer's name + address from a customerId.
 * Returns { name: '', address: '' } if the customer doesn't exist.
 */
async function resolveCustomer(
  customerId: Types.ObjectId | string
): Promise<{ name: string; address: string }> {
  const customer = await Customer.findById(customerId).lean()
  if (!customer) return { name: '', address: '' }
  return {
    name: String((customer as Record<string, unknown>).name || ''),
    address: String((customer as Record<string, unknown>).address || ''),
  }
}

/**
 * Build a human-readable remarks string for the mirrored CustomerPayment.
 * Includes the payment type and any original remarks so the Customer Payment
 * module shows where the entry came from.
 */
function buildSyncedRemarks(
  paymentType: string,
  originalRemarks: string,
  billNumber?: string
): string {
  const parts: string[] = []
  if (paymentType) parts.push(paymentType)
  if (billNumber) parts.push(`Bill ${billNumber}`)
  if (originalRemarks) parts.push(originalRemarks)
  // Tag so the user can see at a glance this came from the Payments module
  parts.push('[synced from Payments]')
  return parts.join(' • ')
}

// ── CREATE mirror ──────────────────────────────────────────────────────────
/**
 * Called after a Payment is created. Creates a matching CustomerPayment and
 * stores its _id on the Payment via `customerPaymentId`.
 *
 * @param paymentId  The _id of the just-created Payment
 * @param customerId The Payment's customerId
 * @param amount     The Payment's amount
 * @param date       The Payment's date (YYYY-MM-DD)
 * @param paymentType  The Payment's paymentType
 * @param remarks    The Payment's original remarks
 * @param billNumber Optional linked bill number
 */
export async function syncCreateCustomerPayment(args: {
  paymentId: Types.ObjectId | string
  customerId: Types.ObjectId | string
  amount: number
  date: string
  paymentType: string
  remarks: string
  billNumber?: string
}): Promise<void> {
  try {
    await connectDB()
    const { name, address } = await resolveCustomer(args.customerId)
    if (!name) {
      console.warn(
        '[payment-customer-sync] skip create: customer not found for',
        String(args.customerId)
      )
      return
    }

    const mirror = await CustomerPayment.create({
      date: args.date,
      name,
      address,
      amount: Number(args.amount) || 0,
      remarks: buildSyncedRemarks(args.paymentType, args.remarks, args.billNumber),
    })

    // Link back so future updates / deletes can find the mirror quickly.
    await Payment.findByIdAndUpdate(args.paymentId, {
      customerPaymentId: mirror._id,
    })
  } catch (err) {
    console.error('[payment-customer-sync] create failed:', err)
  }
}

// ── UPDATE mirror ──────────────────────────────────────────────────────────
/**
 * Called after a Payment is updated. Updates the linked CustomerPayment
 * (if any) to match the new values. If the customer changed, re-resolves the
 * new customer's name + address.
 *
 * @param paymentId  The _id of the Payment that was updated
 * @param fields     New field values to mirror
 */
export async function syncUpdateCustomerPayment(args: {
  paymentId: Types.ObjectId | string
  customerId: Types.ObjectId | string
  amount: number
  date: string
  paymentType: string
  remarks: string
  billNumber?: string
}): Promise<void> {
  try {
    await connectDB()
    const existing = await Payment.findById(args.paymentId).lean()
    if (!existing) return
    const mirrorId = (existing as Record<string, unknown>).customerPaymentId as
      | Types.ObjectId
      | null
      | undefined
    if (!mirrorId) {
      // No mirror exists yet — create one. Handles the case where a Payment
      // was created before this sync feature was deployed.
      await syncCreateCustomerPayment({
        paymentId: args.paymentId,
        customerId: args.customerId,
        amount: args.amount,
        date: args.date,
        paymentType: args.paymentType,
        remarks: args.remarks,
        billNumber: args.billNumber,
      })
      return
    }

    const { name, address } = await resolveCustomer(args.customerId)
    if (!name) {
      console.warn(
        '[payment-customer-sync] skip update: customer not found for',
        String(args.customerId)
      )
      return
    }

    await CustomerPayment.findByIdAndUpdate(mirrorId, {
      date: args.date,
      name,
      address,
      amount: Number(args.amount) || 0,
      remarks: buildSyncedRemarks(args.paymentType, args.remarks, args.billNumber),
    })
  } catch (err) {
    console.error('[payment-customer-sync] update failed:', err)
  }
}

// ── DELETE mirror ──────────────────────────────────────────────────────────
/**
 * Called BEFORE a Payment is deleted (so we can still read its
 * customerPaymentId). Deletes the linked CustomerPayment if one exists.
 *
 * @param paymentId  The _id of the Payment about to be deleted
 */
export async function syncDeleteCustomerPayment(
  paymentId: Types.ObjectId | string
): Promise<void> {
  try {
    await connectDB()
    const existing = await Payment.findById(paymentId).lean()
    if (!existing) return
    const mirrorId = (existing as Record<string, unknown>).customerPaymentId as
      | Types.ObjectId
      | null
      | undefined
    if (!mirrorId) return

    await CustomerPayment.findByIdAndDelete(mirrorId)
  } catch (err) {
    console.error('[payment-customer-sync] delete failed:', err)
  }
}
