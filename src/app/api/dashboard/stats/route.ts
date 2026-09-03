import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {
  Production, Stock, DailySell, LabourPayment, CustomerPayment,
  TractorPayment, DustPurchase, CementPurchase, Hardner,
  Electricity, FactoryStuff,
} from '@/lib/models'
import { requireSession } from '@/lib/auth'

// Force dynamic — stats change after every mutation.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Single endpoint that returns ALL dashboard KPIs in one round-trip.
// Replaces the old approach where the dashboard made 11 separate API
// calls (each fetching ALL records) and then filtered client-side.
// Now we use MongoDB aggregation pipelines + indexes so each query
// only returns the numbers we actually need.
export async function GET() {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    await connectDB()

    const today = new Date().toISOString().split('T')[0]

    // ── Run all aggregations in parallel ────────────────────────────────
    // Each aggregation uses $match on the indexed `date` field, then
    // $group to compute the sum server-side. This means MongoDB only
    // streams a single number back over the wire, not entire documents.
    const [
      todayProductionAgg,
      latestStockAgg,
      todayDailySellAgg,
      todayLabourAgg,
      todayCustomerPaymentAgg,
      tractorRemainingAgg,
      todayDustAgg,
      todayCementAgg,
      todayHardnerAgg,
      todayElectricityAgg,
      todayFactoryStuffAgg,
    ] = await Promise.all([
      // Today's production — sum of all product piece columns
      Production.aggregate([
        { $match: { date: today } },
        { $group: {
          _id: null,
          pieces: {
            $sum: {
              $add: [
                { $ifNull: ['$zigZagGrey80', 0] },
                { $ifNull: ['$zigZagRed80', 0] },
                { $ifNull: ['$zigZagYellow80', 0] },
                { $ifNull: ['$zigZagGrey60', 0] },
                { $ifNull: ['$zigZagRed60', 0] },
                { $ifNull: ['$zigZagYellow60', 0] },
                { $ifNull: ['$curveStone', 0] },
                { $ifNull: ['$chequreTile', 0] },
                { $ifNull: ['$dumbleGrey80', 0] },
                { $ifNull: ['$dumbleRed80', 0] },
                { $ifNull: ['$dumbleYellow80', 0] },
              ],
            },
          },
        }},
      ]),

      // Latest stock entry — get the most recent stock row
      Stock.find({}).sort({ date: -1 }).limit(1).lean(),

      // Today's daily sell — sum of amount
      DailySell.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),

      // Today's labour payments — sum of amount
      LabourPayment.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),

      // Today's customer payments — sum of amount
      CustomerPayment.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),

      // Tractor remaining — sum across ALL tractor payments (not just today)
      TractorPayment.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$remainingAmount', 0] } } } },
      ]),

      // Today's dust purchase — sum of totalAmount
      DustPurchase.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      ]),

      // Today's cement purchase — sum of totalAmount
      CementPurchase.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      ]),

      // Today's hardner — sum of amount
      Hardner.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),

      // Today's electricity — sum of amount
      Electricity.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),

      // Today's factory stuff — sum of amount
      FactoryStuff.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),
    ])

    // Extract scalar values from aggregation results
    const pick = (agg: { _id: null; total?: number; pieces?: number }[], key: 'total' | 'pieces') =>
      agg && agg.length > 0 ? Number(agg[0][key] || 0) : 0

    const todayProduction = pick(todayProductionAgg as any, 'pieces')
    const todaySales = pick(todayDailySellAgg as any, 'total')
    const todayLabourPayments = pick(todayLabourAgg as any, 'total')
    const todayCustomerPayments = pick(todayCustomerPaymentAgg as any, 'total')
    const totalTractorRemaining = pick(tractorRemainingAgg as any, 'total')
    const todayDustPurchase = pick(todayDustAgg as any, 'total')
    const todayCementPurchase = pick(todayCementAgg as any, 'total')
    const todayHardner = pick(todayHardnerAgg as any, 'total')
    const todayElectricity = pick(todayElectricityAgg as any, 'total')
    const todayFactoryStuff = pick(todayFactoryStuffAgg as any, 'total')

    // Latest stock totals
    const latest = (latestStockAgg && latestStockAgg.length > 0) ? latestStockAgg[0] : null
    const totalStockPieces = latest ? (
      Number(latest.zigZagGrey80 || 0) +
      Number(latest.zigZagRed80 || 0) +
      Number(latest.zigZagYellow80 || 0) +
      Number(latest.zigZagGrey60 || 0) +
      Number(latest.zigZagRed60 || 0) +
      Number(latest.zigZagYellow60 || 0) +
      Number(latest.chequreTile || 0) +
      Number(latest.curveStone || 0) +
      Number(latest.dumbleGrey80 || 0) +
      Number(latest.dumbleRed80 || 0) +
      Number(latest.dumbleYellow80 || 0)
    ) : 0
    const totalStockCement = latest ? Number(latest.cement || 0) : 0

    const totalExpensesToday =
      todayLabourPayments + todayDustPurchase + todayCementPurchase +
      todayHardner + todayElectricity + todayFactoryStuff

    const res = NextResponse.json({
      todayProduction,
      todaySales,
      todayLabourPayments,
      todayCustomerPayments,
      totalTractorRemaining,
      todayDustPurchase,
      todayCementPurchase,
      todayHardner,
      todayElectricity,
      todayFactoryStuff,
      totalStock: totalStockPieces,
      totalStockCement,
      totalExpensesToday,
      netCashFlow: todaySales + todayCustomerPayments - totalExpensesToday,
    })

    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
