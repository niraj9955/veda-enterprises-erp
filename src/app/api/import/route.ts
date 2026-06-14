import { NextResponse } from 'next/server'
import { connectDB, toObject } from '@/lib/db'
import { Customer, Production, Stock, Order, Dispatch, Payment, Expense } from '@/lib/models'

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { module, data } = body

    if (!module || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Module and data array are required' }, { status: 400 })
    }

    let imported = 0
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i]

        switch (module) {
          case 'customers': {
            if (!row.name || !row.mobile) {
              errors.push(`Row ${i + 1}: Name and mobile are required`)
              continue
            }
            await Customer.create({
              name: row.name,
              mobile: row.mobile,
              gstNumber: row.gstNumber || '',
              address: row.address || '',
              creditLimit: Number(row.creditLimit) || 0,
            })
            imported++
            break
          }

          case 'production': {
            if (!row.date || !row.brickType || !row.quantityProduced) {
              errors.push(`Row ${i + 1}: Date, brick type, and quantity are required`)
              continue
            }
            await Production.create({
              date: row.date,
              brickType: row.brickType,
              quantityProduced: Number(row.quantityProduced),
              shift: row.shift || 'Morning',
              remarks: row.remarks || '',
            })

            // Auto-update stock
            let stock = await Stock.findOne({ brickType: row.brickType })
            if (!stock) {
              await Stock.create({ brickType: row.brickType, openingStock: 0, currentStock: Number(row.quantityProduced) })
            } else {
              stock.currentStock += Number(row.quantityProduced)
              await stock.save()
            }
            imported++
            break
          }

          case 'orders': {
            if (!row.customerId || !row.brickType || !row.quantity || !row.rate) {
              errors.push(`Row ${i + 1}: Customer, brick type, quantity, and rate are required`)
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
              errors.push(`Row ${i + 1}: Customer, truck number, quantity, brick type, and date are required`)
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

            // Auto-update stock
            const stock = await Stock.findOne({ brickType: row.brickType })
            if (stock) {
              stock.currentStock = Math.max(0, stock.currentStock - Number(row.quantity))
              await stock.save()
            }
            imported++
            break
          }

          case 'payments': {
            if (!row.customerId || !row.paymentType || !row.amount || !row.date) {
              errors.push(`Row ${i + 1}: Customer, payment type, amount, and date are required`)
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
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }
}
