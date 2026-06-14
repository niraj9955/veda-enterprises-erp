import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Excel Import API - Bulk import data from Excel sheets
// Supports smart column mapping with customer name resolution, date parsing, and auto-calculation

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { module, data } = body

    if (!module || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Module name and data array are required' }, { status: 400 })
    }

    let imported = 0
    let errors: string[] = []

    // Pre-fetch customers for name resolution
    let customerMap: Map<string, string> = new Map()
    if (['orders', 'dispatch', 'payments'].includes(module)) {
      const customers = await db.customer.findMany({ select: { id: true, name: true } })
      for (const c of customers) {
        customerMap.set(c.name.toLowerCase().trim(), c.id)
        customerMap.set(c.name.trim(), c.id) // Also store original case
      }
    }

    // Helper: resolve customer ID from name or ID
    const resolveCustomerId = (value: string): string | null => {
      if (!value) return null
      const trimmed = value.trim()
      
      // If it looks like a CUID (25+ chars starting with letter), use as-is
      if (trimmed.length >= 20 && /^[a-z0-9]+$/.test(trimmed)) {
        return trimmed
      }
      
      // Try exact match (case-insensitive)
      const lower = trimmed.toLowerCase()
      if (customerMap.has(lower)) return customerMap.get(lower)!
      if (customerMap.has(trimmed)) return customerMap.get(trimmed)!
      
      // Try partial match
      for (const [name, id] of customerMap.entries()) {
        if (name.includes(lower) || lower.includes(name)) {
          return id
        }
      }
      
      return null
    }

    // Helper: auto-generate order number
    let orderCounter = 0
    const generateOrderNumber = () => {
      orderCounter++
      return `ORD-${Date.now()}-${orderCounter}`
    }

    // Helper: auto-generate dispatch number
    let dispatchCounter = 0
    const generateDispatchNumber = () => {
      dispatchCounter++
      return `DSP-${Date.now()}-${dispatchCounter}`
    }

    switch (module) {
      case 'customers': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          try {
            // Resolve field from various possible keys
            const name = String(row.name || row.customerName || row.customer_name || row['Customer Name'] || row['customer name'] || '').trim()
            const mobile = String(row.mobile || row.phone || row.mobileNumber || row.mobile_number || row['Mobile Number'] || row['Phone'] || row.contact || '').trim()
            
            if (!name || !mobile) {
              errors.push(`Row ${i + 1}: Name and Mobile are required (got: name="${name}", mobile="${mobile}")`)
              continue
            }

            await db.customer.create({
              data: {
                name,
                mobile,
                gstNumber: String(row.gstNumber || row.gst_number || row.gst || row.gstin || row['GST Number'] || ''),
                address: String(row.address || row.addr || ''),
                creditLimit: Number(row.creditLimit || row.credit_limit || row['Credit Limit'] || row.credit || 0),
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
            const date = String(row.date || row.productionDate || row.production_date || '')
            const brickType = String(row.brickType || row.brick_type || row['Brick Type'] || row.type || row.brick || '')
            const qtyRaw = row.quantityProduced || row.quantity_produced || row.quantityProduced || row.quantity || row.qty || row['Quantity Produced'] || 0
            const qty = Number(String(qtyRaw).replace(/[^0-9.-]/g, '') || 0)

            if (!date || !brickType || !qty) {
              errors.push(`Row ${i + 1}: Date, Brick Type, and Quantity are required`)
              continue
            }

            // Normalize shift
            let shift = String(row.shift || 'Morning').trim()
            const shiftLower = shift.toLowerCase()
            if (shiftLower.includes('morn') || shiftLower === '1' || shiftLower.includes('सुबह')) shift = 'Morning'
            else if (shiftLower.includes('eve') || shiftLower === '2' || shiftLower.includes('शाम')) shift = 'Evening'
            else if (shiftLower.includes('night') || shiftLower === '3' || shiftLower.includes('रात')) shift = 'Night'

            const production = await db.production.create({
              data: {
                date,
                brickType,
                quantityProduced: qty,
                shift,
                remarks: String(row.remarks || row.note || row.comment || ''),
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
            // Resolve customer ID
            const customerIdentifier = String(row.customerId || row.customer_id || row.customerName || row.customer_name || row['Customer Name'] || row.customer || row.name || '')
            const customerId = resolveCustomerId(customerIdentifier)
            
            const brickType = String(row.brickType || row.brick_type || row['Brick Type'] || row.type || '')
            const qty = Number(String(row.quantity || row.qty || 0).replace(/[^0-9.-]/g, '') || 0)
            const rate = Number(String(row.rate || row.price || row.unit_price || 0).replace(/[^0-9.-]/g, '') || 0)

            if (!customerId || !brickType || !qty || !rate) {
              errors.push(`Row ${i + 1}: Customer "${customerIdentifier}" not found or missing required fields (Brick Type, Quantity, Rate)`)
              continue
            }

            const amount = Number(row.amount || row.total || qty * rate)

            await db.order.create({
              data: {
                orderNumber: String(row.orderNumber || row.order_number || generateOrderNumber()),
                customerId,
                brickType,
                quantity: qty,
                rate,
                amount,
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
            // Resolve customer ID
            const customerIdentifier = String(row.customerId || row.customer_id || row.customerName || row.customer_name || row['Customer Name'] || row.customer || row.name || '')
            const customerId = resolveCustomerId(customerIdentifier)
            
            const brickType = String(row.brickType || row.brick_type || row['Brick Type'] || row.type || '')
            const qty = Number(String(row.quantity || row.qty || 0).replace(/[^0-9.-]/g, '') || 0)
            const date = String(row.date || row.dispatchDate || row.dispatch_date || '')

            if (!customerId || !qty || !date) {
              errors.push(`Row ${i + 1}: Customer "${customerIdentifier}" not found or missing required fields (Quantity, Date)`)
              continue
            }

            // Try to find matching order for this customer and brick type
            let orderId: string | null = null
            if (row.orderId || row.order_id) {
              orderId = String(row.orderId || row.order_id)
            } else {
              // Auto-match: find a pending/processing order for this customer & brick type
              const matchingOrder = await db.order.findFirst({
                where: {
                  customerId,
                  brickType: brickType || undefined,
                  status: { in: ['Pending', 'Processing'] },
                },
                orderBy: { createdAt: 'desc' },
              })
              if (matchingOrder) orderId = matchingOrder.id
            }

            await db.dispatch.create({
              data: {
                dispatchNumber: String(row.dispatchNumber || row.dispatch_number || generateDispatchNumber()),
                customerId,
                orderId,
                truckNumber: String(row.truckNumber || row.truck_number || row['Truck Number'] || row.vehicle || row.vehicle_number || ''),
                driverName: String(row.driverName || row.driver_name || row['Driver Name'] || row.driver || ''),
                quantity: qty,
                brickType,
                date,
              },
            })

            // Auto-decrement stock
            if (brickType) {
              const existingStock = await db.stock.findUnique({ where: { brickType } })
              if (existingStock) {
                await db.stock.update({
                  where: { brickType },
                  data: { currentStock: Math.max(0, existingStock.currentStock - qty) },
                })
              }
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
            // Resolve customer ID
            const customerIdentifier = String(row.customerId || row.customer_id || row.customerName || row.customer_name || row['Customer Name'] || row.customer || row.name || row['Received From'] || '')
            const customerId = resolveCustomerId(customerIdentifier)
            
            const amount = Number(String(row.amount || row.total || 0).replace(/[^0-9.-]/g, '') || 0)
            const date = String(row.date || row.paymentDate || row.payment_date || '')

            if (!customerId || !amount || !date) {
              errors.push(`Row ${i + 1}: Customer "${customerIdentifier}" not found or missing required fields (Amount, Date)`)
              continue
            }

            // Normalize payment type
            let paymentType = String(row.paymentType || row.payment_type || row.mode || 'Cash').trim()
            const ptLower = paymentType.toLowerCase()
            if (ptLower.includes('cash') || ptLower.includes('नकद')) paymentType = 'Cash'
            else if (ptLower.includes('upi') || ptLower.includes('online')) paymentType = 'UPI'
            else if (ptLower.includes('bank') || ptLower.includes('transfer') || ptLower.includes('neft')) paymentType = 'Bank Transfer'

            await db.payment.create({
              data: {
                customerId,
                paymentType,
                amount,
                date,
                remarks: String(row.remarks || row.note || row.description || ''),
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
            // Normalize category
            let category = String(row.category || row.type || row.expense_type || '').trim()
            const catLower = category.toLowerCase()
            if (catLower.includes('labour') || catLower.includes('labor') || catLower.includes('मजदूर') || catLower.includes('wage')) category = 'Labour'
            else if (catLower.includes('coal') || catLower.includes('कोयला')) category = 'Coal'
            else if (catLower.includes('diesel') || catLower.includes('डीज़ल') || catLower.includes('fuel')) category = 'Diesel'
            else if (catLower.includes('maint') || catLower.includes('रखरखाव') || catLower.includes('repair')) category = 'Maintenance'
            else if (catLower.includes('elect') || catLower.includes('बिजली') || catLower.includes('power')) category = 'Electricity'

            const amount = Number(String(row.amount || row.total || row.cost || 0).replace(/[^0-9.-]/g, '') || 0)
            const date = String(row.date || row.expense_date || '')

            if (!category || !amount || !date) {
              errors.push(`Row ${i + 1}: Category, Amount, and Date are required`)
              continue
            }

            await db.expense.create({
              data: {
                category,
                amount,
                date,
                description: String(row.description || row.desc || row.details || ''),
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
