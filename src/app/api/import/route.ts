import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import {
  Customer, Production, Stock, Order, Dispatch, Payment, Expense,
  DailySell, CustomerPayment, LabourPayment, TractorPayment,
  DustPurchase, CementPurchase, Hardner, Electricity, FactoryStuff,
} from '@/lib/models'

// Force dynamic — this route must never be cached/previewed as a static asset.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { module, data } = body

    if (!module || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Module and data array are required' }, { status: 400 })
    }

    // IMPORTANT — APPEND-ONLY import semantics:
    // This route NEVER calls deleteMany / replaceOne / updateOne to wipe
    // existing rows before inserting. Every iteration only calls Model.create()
    // (or upsert-by-natural-key for Customers). Importing Jan 11-20 after
    // Jan 1-10 will therefore LEAVE the Jan 1-10 rows in place and ADD the
    // new rows on top. This is intentional and required by the business.

    let imported = 0
    let skipped = 0
    const errors: string[] = []
    const skippedReasons: string[] = []

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i]

        switch (module) {
          // ─── Customers ──────────────────────────────────────────────
          case 'customers': {
            if (!row.name || !row.mobile) {
              errors.push(`Row ${i + 1}: Name and mobile are required`)
              skipped++
              continue
            }
            // Dedupe by mobile (same customer exists → skip)
            const exists = await Customer.findOne({ mobile: String(row.mobile).trim() })
            if (exists) {
              skipped++
              skippedReasons.push(`Row ${i + 1}: Customer "${String(row.name).trim()}" (mobile ${row.mobile}) already exists — skipped`)
              continue
            }

            await Customer.create({
              name: String(row.name).trim(),
              mobile: String(row.mobile).trim(),
              gstNumber: row.gstNumber || '',
              address: row.address || '',
              creditLimit: Number(row.creditLimit) || 0,
            })
            imported++
            break
          }

          // ─── Production ─────────────────────────────────────────────
          case 'production': {
            if (!row.date) {
              errors.push(`Row ${i + 1}: Date is required`)
              skipped++
              continue
            }
            await Production.create({
              date: String(row.date),
              customerName: String(row.customerName || row.customer || ''),
              address: String(row.address || ''),
              zigZagWhite80: Number(row.zigZagWhite80) || 0,
              zigZagRed80: Number(row.zigZagRed80) || 0,
              zigZagYellow80: Number(row.zigZagYellow80) || 0,
              zigZagWhite60: Number(row.zigZagWhite60) || 0,
              zigZagRed60: Number(row.zigZagRed60) || 0,
              zigZagYellow60: Number(row.zigZagYellow60) || 0,
              curveStone: Number(row.curveStone) || 0,
              chequreTile: Number(row.chequreTile) || 0,
              transportationCharge: Number(row.transportationCharge) || 0,
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Stock ─────────────────────────────────────────────────
          case 'stock': {
            if (!row.date) {
              errors.push(`Row ${i + 1}: Date is required`)
              skipped++
              continue
            }
            await Stock.create({
              date: String(row.date),
              cement: Number(row.cement) || 0,
              zigZagGrey80: Number(row.zigZagGrey80) || 0,
              zigZagRed80: Number(row.zigZagRed80) || 0,
              zigZagYellow80: Number(row.zigZagYellow80) || 0,
              zigZagGrey60: Number(row.zigZagGrey60) || 0,
              zigZagRed60: Number(row.zigZagRed60) || 0,
              zigZagYellow60: Number(row.zigZagYellow60) || 0,
              chequreTile: Number(row.chequreTile) || 0,
              curveStone: Number(row.curveStone) || 0,
              dumbleGrey80: Number(row.dumbleGrey80) || 0,
              dumbleRed80: Number(row.dumbleRed80) || 0,
              dumbleYellow80: Number(row.dumbleYellow80) || 0,
            })
            imported++
            break
          }

          // ─── Daily Sell ────────────────────────────────────────────
          case 'dailySell': {
            if (!row.date || !row.customerName || !row.amount) {
              errors.push(`Row ${i + 1}: Date, customer name, and amount are required`)
              skipped++
              continue
            }
            await DailySell.create({
              date: String(row.date),
              customerName: String(row.customerName),
              address: String(row.address || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
              contactNumber: String(row.contactNumber || row.mobile || ''),
            })
            imported++
            break
          }

          // ─── Customer Payment ──────────────────────────────────────
          case 'customerPayment': {
            if (!row.date || !row.name || !row.amount) {
              errors.push(`Row ${i + 1}: Date, name, and amount are required`)
              skipped++
              continue
            }
            await CustomerPayment.create({
              date: String(row.date),
              name: String(row.name),
              address: String(row.address || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Labour Payment ────────────────────────────────────────
          case 'labourPayment': {
            if (!row.date || !row.name || !row.amount) {
              errors.push(`Row ${i + 1}: Date, name, and amount are required`)
              skipped++
              continue
            }
            await LabourPayment.create({
              date: String(row.date),
              name: String(row.name),
              address: String(row.address || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Tractor Payment ───────────────────────────────────────
          case 'tractorPayment': {
            if (!row.date || !row.vendorName || !row.quantityTon || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantityTon)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            await TractorPayment.create({
              date: String(row.date),
              vendorName: String(row.vendorName),
              quantityTon: qty,
              rate,
              totalAmount,
              paidAmount,
              remainingAmount: Number(row.remainingAmount) || (totalAmount - paidAmount),
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Dust Purchase ─────────────────────────────────────────
          case 'dustPurchase': {
            if (!row.date || !row.vendorName || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantity)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            await DustPurchase.create({
              date: String(row.date),
              vendorName: String(row.vendorName),
              cementName: String(row.cementName || ''),
              quantity: qty,
              rate,
              totalAmount,
              paidAmount,
              transportationCharge: Number(row.transportationCharge) || 0,
              gst: Number(row.gst) || 0,
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Cement Purchase ───────────────────────────────────────
          case 'cementPurchase': {
            if (!row.date || !row.vendorName || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Date, vendor, quantity, and rate are required`)
              skipped++
              continue
            }
            const qty = Number(row.quantity)
            const rate = Number(row.rate)
            const totalAmount = Number(row.totalAmount) || qty * rate
            const paidAmount = Number(row.paidAmount) || 0
            await CementPurchase.create({
              date: String(row.date),
              vendorName: String(row.vendorName),
              itemName: String(row.itemName || ''),
              quantity: qty,
              rate,
              totalAmount,
              paidAmount,
              transportationCharge: Number(row.transportationCharge) || 0,
              gst: Number(row.gst) || 0,
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Hardner ───────────────────────────────────────────────
          case 'hardner': {
            if (!row.date || !row.amount) {
              errors.push(`Row ${i + 1}: Date and amount are required`)
              skipped++
              continue
            }
            await Hardner.create({
              date: String(row.date),
              amount: Number(row.amount),
            })
            imported++
            break
          }

          // ─── Electricity ───────────────────────────────────────────
          case 'electricity': {
            if (!row.date || !row.amount) {
              errors.push(`Row ${i + 1}: Date and amount are required`)
              skipped++
              continue
            }
            await Electricity.create({
              date: String(row.date),
              name: String(row.name || ''),
              work: String(row.work || ''),
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Factory Stuff ─────────────────────────────────────────
          case 'factoryStuff': {
            if (!row.date || !row.itemName || !row.amount) {
              errors.push(`Row ${i + 1}: Date, item name, and amount are required`)
              skipped++
              continue
            }
            await FactoryStuff.create({
              date: String(row.date),
              itemName: String(row.itemName),
              quantity: Number(row.quantity) || 0,
              amount: Number(row.amount),
              remarks: String(row.remarks || ''),
            })
            imported++
            break
          }

          // ─── Legacy modules (Orders/Dispatch/Payments/Expenses) ────
          case 'orders': {
            if (!row.customerId || !row.brickType || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Customer, brick type, quantity, and rate are required`)
              skipped++
              continue
            }
            const count = await Order.countDocuments({})
            const { Company } = await import('@/lib/models')
            const company = await Company.findOne({})
            const prefix = company?.orderPrefix || 'ORD'
            const orderNumber = `${prefix}-${String(count + imported + 1).padStart(4, '0')}`

            await Order.create({
              orderNumber,
              customerId: row.customerId,
              brickType: row.brickType,
              quantity: Number(row.quantity),
              rate: Number(row.rate),
              amount: Number(row.amount) || Number(row.quantity) * Number(row.rate),
              deliveryDate: row.deliveryDate || row.date || new Date().toISOString().split('T')[0],
              status: row.status || 'Pending',
            })
            imported++
            break
          }

          case 'dispatch': {
            if (!row.customerId || !row.truckNumber || !row.quantity || !row.brickType || !row.date) {
              errors.push(`Row ${i + 1}: Customer, truck, quantity, brick type, and date are required`)
              skipped++
              continue
            }
            const count = await Dispatch.countDocuments({})
            const { Company } = await import('@/lib/models')
            const company = await Company.findOne({})
            const prefix = company?.dispatchPrefix || 'DSP'
            const dispatchNumber = `${prefix}-${String(count + imported + 1).padStart(4, '0')}`

            await Dispatch.create({
              dispatchNumber,
              customerId: row.customerId,
              orderId: row.orderId || null,
              truckNumber: row.truckNumber,
              driverName: row.driverName || '',
              quantity: Number(row.quantity),
              brickType: row.brickType,
              date: row.date,
            })
            imported++
            break
          }

          case 'payments': {
            if (!row.customerId || !row.paymentType || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Customer, payment type, amount, and date are required`)
              skipped++
              continue
            }
            await Payment.create({
              customerId: row.customerId,
              paymentType: row.paymentType,
              amount: Number(row.amount),
              date: row.date,
              remarks: row.remarks || '',
            })
            imported++
            break
          }

          case 'expenses': {
            if (!row.category || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Category, amount, and date are required`)
              skipped++
              continue
            }
            await Expense.create({
              category: row.category,
              amount: Number(row.amount),
              date: row.date,
              description: row.description || '',
            })
            imported++
            break
          }

          default:
            errors.push(`Unknown module: ${module}`)
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Import failed'}`)
        skipped++
      }
    }

    // Merge errors and skippedReasons so the UI can show every reason a row
    // was not imported (validation error OR duplicate OR anything else).
    const allReasons = [...errors, ...skippedReasons]

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: data.length,
      errors: allReasons.length > 0 ? allReasons.slice(0, 50) : undefined,
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }
}

// GET endpoint — return all available modules + their required fields for import template
export async function GET() {
  const modules = [
    { id: 'customers', label: 'Customers', fields: ['name', 'mobile', 'address', 'gstNumber', 'creditLimit'] },
    { id: 'production', label: 'Production', fields: ['date', 'customerName', 'address', 'zigZagWhite80', 'zigZagRed80', 'zigZagYellow80', 'zigZagWhite60', 'zigZagRed60', 'zigZagYellow60', 'curveStone', 'chequreTile', 'transportationCharge', 'remarks'] },
    { id: 'stock', label: 'Stock', fields: ['date', 'cement', 'zigZagGrey80', 'zigZagRed80', 'zigZagYellow80', 'zigZagGrey60', 'zigZagRed60', 'zigZagYellow60', 'chequreTile', 'curveStone', 'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80'] },
    { id: 'dailySell', label: 'Daily Sell', fields: ['date', 'customerName', 'address', 'amount', 'remarks', 'contactNumber'] },
    { id: 'customerPayment', label: 'Customer Payment', fields: ['date', 'name', 'address', 'amount', 'remarks'] },
    { id: 'labourPayment', label: 'Labour Payment', fields: ['date', 'name', 'address', 'amount', 'remarks'] },
    { id: 'tractorPayment', label: 'Tractor Payment', fields: ['date', 'vendorName', 'quantityTon', 'rate', 'totalAmount', 'paidAmount', 'remainingAmount', 'remarks'] },
    { id: 'dustPurchase', label: 'Dust Purchase', fields: ['date', 'vendorName', 'cementName', 'quantity', 'rate', 'totalAmount', 'paidAmount', 'transportationCharge', 'gst', 'remarks'] },
    { id: 'cementPurchase', label: 'Cement Purchase', fields: ['date', 'vendorName', 'itemName', 'quantity', 'rate', 'totalAmount', 'paidAmount', 'transportationCharge', 'gst', 'remarks'] },
    { id: 'hardner', label: 'Hardner', fields: ['date', 'amount'] },
    { id: 'electricity', label: 'Electricity', fields: ['date', 'name', 'work', 'amount', 'remarks'] },
    { id: 'factoryStuff', label: 'Factory Stuff', fields: ['date', 'itemName', 'quantity', 'amount', 'remarks'] },
  ]
  return NextResponse.json({ modules })
}
