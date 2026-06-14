import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Excel Import API - Bulk import data from Excel sheets
// Each row is expected to match the schema fields for the given module

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { module, data } = body

    if (!module || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Module name and data array are required' }, { status: 400 })
    }

    let imported = 0
    let errors: string[] = []

    switch (module) {
      case 'customers': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            if (!row.name || !row.mobile) {
              errors.push(`Row ${i + 1}: Name and Mobile are required`)
              continue
            }
            await db.customer.create({
              data: {
                name: String(row.name || ''),
                mobile: String(row.mobile || ''),
                gstNumber: String(row.gstNumber || row.gst_number || row['GST Number'] || ''),
                address: String(row.address || ''),
                creditLimit: Number(row.creditLimit || row.credit_limit || row['Credit Limit'] || 0),
              },
            })
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      case 'production': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            if (!row.date || !row.brickType || !row.quantityProduced) {
              errors.push(`Row ${i + 1}: Date, Brick Type, and Quantity are required`)
              continue
            }
            const brickType = String(row.brickType || row.brick_type || row['Brick Type'] || '')
            const qty = Number(row.quantityProduced || row.quantity_produced || row['Quantity Produced'] || row.quantity || 0)

            const production = await db.production.create({
              data: {
                date: String(row.date || ''),
                brickType,
                quantityProduced: qty,
                shift: String(row.shift || 'Morning'),
                remarks: String(row.remarks || ''),
              },
            })

            // Auto-update stock
            const existingStock = await db.stock.findUnique({ where: { brickType } })
            if (existingStock) {
              await db.stock.update({
                where: { brickType },
                data: { currentStock: existingStock.currentStock + qty },
              })
            } else {
              await db.stock.create({
                data: { brickType, openingStock: 0, currentStock: qty },
              })
            }
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      case 'orders': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            const customerId = String(row.customerId || row.customer_id || '')
            if (!customerId || !row.brickType || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Customer ID, Brick Type, Quantity, and Rate are required`)
              continue
            }
            const qty = Number(row.quantity || 0)
            const rate = Number(row.rate || 0)
            await db.order.create({
              data: {
                orderNumber: String(row.orderNumber || row.order_number || `ORD-${Date.now()}-${i}`),
                customerId,
                brickType: String(row.brickType || row.brick_type || row['Brick Type'] || ''),
                quantity: qty,
                rate,
                amount: Number(row.amount || qty * rate),
                deliveryDate: String(row.deliveryDate || row.delivery_date || row['Delivery Date'] || new Date().toISOString().split('T')[0]),
                status: String(row.status || 'Pending'),
              },
            })
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      case 'dispatch': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            const customerId = String(row.customerId || row.customer_id || '')
            if (!customerId || !row.quantity || !row.date) {
              errors.push(`Row ${i + 1}: Customer ID, Quantity, and Date are required`)
              continue
            }
            const brickType = String(row.brickType || row.brick_type || row['Brick Type'] || '')
            const qty = Number(row.quantity || 0)

            await db.dispatch.create({
              data: {
                dispatchNumber: String(row.dispatchNumber || row.dispatch_number || `DSP-${Date.now()}-${i}`),
                customerId,
                orderId: row.orderId || row.order_id || null,
                truckNumber: String(row.truckNumber || row.truck_number || row['Truck Number'] || ''),
                driverName: String(row.driverName || row.driver_name || row['Driver Name'] || ''),
                quantity: qty,
                brickType,
                date: String(row.date || ''),
              },
            })

            // Auto-decrement stock
            const existingStock = await db.stock.findUnique({ where: { brickType } })
            if (existingStock) {
              await db.stock.update({
                where: { brickType },
                data: { currentStock: Math.max(0, existingStock.currentStock - qty) },
              })
            }
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      case 'payments': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            const customerId = String(row.customerId || row.customer_id || '')
            if (!customerId || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Customer ID, Amount, and Date are required`)
              continue
            }
            await db.payment.create({
              data: {
                customerId,
                paymentType: String(row.paymentType || row.payment_type || row['Payment Type'] || 'Cash'),
                amount: Number(row.amount || 0),
                date: String(row.date || ''),
                remarks: String(row.remarks || ''),
              },
            })
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      case 'expenses': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            if (!row.category || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Category, Amount, and Date are required`)
              continue
            }
            await db.expense.create({
              data: {
                category: String(row.category || ''),
                amount: Number(row.amount || 0),
                date: String(row.date || ''),
                description: String(row.description || ''),
              },
            })
            imported++
          } catch (e) {
            errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Failed to import'}`)
          }
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown module: ${module}. Supported: customers, production, orders, dispatch, payments, expenses` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
