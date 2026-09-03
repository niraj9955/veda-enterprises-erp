import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { AiConfig, Customer, DailySell, Production, CustomerPayment, LabourPayment, TractorPayment, DustPurchase, CementPurchase, Hardner, Electricity, FactoryStuff, Expense, Bill, Order, Dispatch, Payment } from '@/lib/models'
import { normalizeDate } from '@/lib/date-utils'
import OpenAI from 'openai'
import ZAI from 'z-ai-web-dev-sdk'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Conversation Memory (in-memory, per conversationId) ─────────────
const conversations = new Map<string, { role: string; content: string }[]>()
const MAX_HISTORY = 40 // keep last 40 messages per conversation
const CONVERSATION_TTL = 30 * 60 * 1000 // 30 min
const createdTimes = new Map<string, number>()

function getConversation(id: string) {
  // Evict old conversations
  const now = Date.now()
  for (const [cid, ts] of createdTimes) {
    if (now - ts > CONVERSATION_TTL) {
      conversations.delete(cid)
      createdTimes.delete(cid)
    }
  }
  if (!conversations.has(id)) {
    conversations.set(id, [])
    createdTimes.set(id, now)
  }
  const msgs = conversations.get(id)!
  // Trim to max history
  if (msgs.length > MAX_HISTORY) {
    msgs.splice(0, msgs.length - MAX_HISTORY)
  }
  return msgs
}

// ── Tool Definitions for OpenAI Function Calling ────────────────────
const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_customers',
      description: 'Search for customers by name or mobile number. Returns matching customers with their IDs, names, and mobile numbers.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Customer name or mobile number to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Add a new customer to the ERP system. Use this when the user wants to add a new customer/party/khareedar.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer full name' },
          mobile: { type: 'string', description: 'Mobile number (10 digits)' },
          address: { type: 'string', description: 'Address' },
          gstNumber: { type: 'string', description: 'GST number if available' },
          creditLimit: { type: 'number', description: 'Credit limit in rupees' },
        },
        required: ['name', 'mobile'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_daily_sell',
      description: 'Record a daily sale transaction when a customer buys products (paver blocks, bricks etc). Automatically syncs to Customer, Order, CustomerPayment, Payment, and TractorPayment modules.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          customerName: { type: 'string', description: 'Customer name' },
          address: { type: 'string', description: 'Customer address' },
          contactNumber: { type: 'string', description: 'Customer contact number' },
          product: { type: 'string', description: 'Product name (e.g. Zig Zag Grey 80mm)' },
          quantity: { type: 'number', description: 'Quantity sold' },
          rate: { type: 'number', description: 'Rate per unit' },
          amount: { type: 'number', description: 'Total sale amount in rupees' },
          receivedAmount: { type: 'number', description: 'Amount received from customer' },
          remarks: { type: 'string', description: 'Any remarks or notes' },
        },
        required: ['customerName', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_production',
      description: 'Record daily production of paver blocks. Specify quantities for each product type produced.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          cement: { type: 'number', description: 'Cement bags used' },
          zigZagGrey80: { type: 'number', description: 'Zig Zag Grey 80mm pieces' },
          zigZagRed80: { type: 'number', description: 'Zig Zag Red 80mm pieces' },
          zigZagYellow80: { type: 'number', description: 'Zig Zag Yellow 80mm pieces' },
          zigZagGrey60: { type: 'number', description: 'Zig Zag Grey 60mm pieces' },
          zigZagRed60: { type: 'number', description: 'Zig Zag Red 60mm pieces' },
          zigZagYellow60: { type: 'number', description: 'Zig Zag Yellow 60mm pieces' },
          curveStone: { type: 'number', description: 'Curve Stone pieces' },
          chequreTile: { type: 'number', description: 'Chequre Tile pieces' },
          dumbleGrey80: { type: 'number', description: 'Dumble Grey 80mm pieces' },
          dumbleRed80: { type: 'number', description: 'Dumble Red 80mm pieces' },
          dumbleYellow80: { type: 'number', description: 'Dumble Yellow 80mm pieces' },
          transportationCharge: { type: 'number', description: 'Transport charge in rupees' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer_payment',
      description: 'Record a payment received from a customer against their outstanding balance.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          name: { type: 'string', description: 'Customer name' },
          address: { type: 'string', description: 'Address' },
          amount: { type: 'number', description: 'Payment amount in rupees' },
          remarks: { type: 'string', description: 'Remarks (e.g. payment mode: Cash/UPI/Bank)' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_labour_payment',
      description: 'Record a payment made to a labour worker for their work.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          name: { type: 'string', description: 'Worker name' },
          address: { type: 'string', description: 'Address' },
          amount: { type: 'number', description: 'Payment amount in rupees' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_tractor_payment',
      description: 'Record a payment to a tractor/dumper vendor for raw material transport.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          vendorName: { type: 'string', description: 'Vendor/tractor owner name' },
          quantityTon: { type: 'number', description: 'Quantity in tons' },
          rate: { type: 'number', description: 'Rate per ton in rupees' },
          paidAmount: { type: 'number', description: 'Amount paid' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['vendorName', 'quantityTon', 'rate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_dust_purchase',
      description: 'Record purchase of dust (raw material) from a vendor.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          vendorName: { type: 'string', description: 'Vendor name' },
          cementName: { type: 'string', description: 'Cement/brand name' },
          quantity: { type: 'number', description: 'Quantity' },
          rate: { type: 'number', description: 'Rate per unit' },
          paidAmount: { type: 'number', description: 'Amount paid' },
          transportationCharge: { type: 'number', description: 'Transport charge' },
          gst: { type: 'number', description: 'GST amount' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['vendorName', 'quantity', 'rate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_cement_purchase',
      description: 'Record purchase of cement bags from a vendor.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          vendorName: { type: 'string', description: 'Vendor name' },
          itemName: { type: 'string', description: 'Cement brand/item name' },
          quantity: { type: 'number', description: 'Number of bags' },
          rate: { type: 'number', description: 'Rate per bag' },
          paidAmount: { type: 'number', description: 'Amount paid' },
          transportationCharge: { type: 'number', description: 'Transport charge' },
          gst: { type: 'number', description: 'GST amount' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['vendorName', 'quantity', 'rate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_hardner',
      description: 'Record a hardner chemical purchase (date + amount only).',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          amount: { type: 'number', description: 'Amount in rupees' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_electricity',
      description: 'Record an electricity bill payment.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          name: { type: 'string', description: 'Connection name / bill reference' },
          work: { type: 'string', description: 'Purpose / work description' },
          amount: { type: 'number', description: 'Bill amount in rupees' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_factory_stuff',
      description: 'Record a factory consumable/equipment purchase.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          itemName: { type: 'string', description: 'Item name' },
          quantity: { type: 'number', description: 'Quantity' },
          amount: { type: 'number', description: 'Amount in rupees' },
          remarks: { type: 'string', description: 'Remarks' },
        },
        required: ['itemName', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_expense',
      description: 'Record a business expense under a category.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Expense category (e.g. Rent, Salary, Fuel, Maintenance)' },
          amount: { type: 'number', description: 'Expense amount in rupees' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
          description: { type: 'string', description: 'Description of the expense' },
        },
        required: ['category', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_quotation',
      description: 'Create a quotation/bill for a customer. A quotation is a bill with billType=quotation.',
      parameters: {
        type: 'object',
        properties: {
          toName: { type: 'string', description: 'Customer/party name to bill' },
          toAddress: { type: 'string', description: 'Customer address' },
          toPhone: { type: 'string', description: 'Customer phone' },
          toGst: { type: 'string', description: 'Customer GST number' },
          items: {
            type: 'array',
            description: 'Line items for the bill/quotation',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Item description (product name)' },
                quantity: { type: 'number', description: 'Quantity' },
                unit: { type: 'string', description: 'Unit (e.g. pcs, bags, tons)' },
                rate: { type: 'number', description: 'Rate per unit' },
              },
              required: ['description', 'quantity', 'rate'],
            },
          },
          notes: { type: 'string', description: 'Notes for the bill' },
          paymentMode: { type: 'string', description: 'Payment mode: Cash, UPI, Bank' },
        },
        required: ['toName', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_entries',
      description: 'Get recent entries from any module. Use this when the user asks about recent sales, payments, production, etc.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['dailySell', 'production', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'orders', 'bills', 'expenses', 'dispatch'], description: 'Which module to fetch from' },
          limit: { type: 'number', description: 'Number of entries to return (default 5, max 20)' },
        },
        required: ['module'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description: 'Get today\'s dashboard summary: today\'s production, sales, payments, stock total, net cash flow etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

const SYSTEM_PROMPT = `You are the AI assistant for Veda Enterprises ERP — a paver block manufacturing business in India. You can perform real actions in the system using tools.

YOUR CAPABILITIES:
- Create entries in ANY module: Daily Sell, Production, Customer Payment, Labour Payment, Tractor Payment, Dust Purchase, Cement Purchase, Hardner, Electricity, Factory Stuff, Expenses
- Create Quotations/Bills for customers
- Search customers by name or mobile
- View recent entries from any module
- Get dashboard summary (today's stats)

IMPORTANT RULES:
1. Speak in the SAME LANGUAGE the user uses (Hindi/Hinglish → Hinglish, English → English)
2. Before creating an entry, if the user hasn't provided all required info, ASK them for the missing details. Don't guess critical values.
3. For dates: if user says "aaj/today" use today's date, "kal/yesterday" use yesterday. Always use YYYY-MM-DD format internally.
4. For amounts in Hindi: "ek"=1, "do"=2, "teen"=3, "char"=4, "panch"=5, "chhe"=6, "saat"=7, "aath"=8, "nau"=9, "das"=10, "sau"=100, "hazaar"=1000, "lakh"=100000
5. Be conversational and helpful. After performing an action, confirm what was done with key details.
6. If user asks to update/delete something, tell them to use the respective module's interface for now (you can create and search).
7. Today's date is ${new Date().toISOString().slice(0, 10)}.
8. When creating a daily sell, if the user mentions a product and rate but not quantity, calculate quantity = amount / rate. If they mention quantity and rate but not amount, calculate amount = quantity * rate.
9. Keep responses concise but informative. Don't be overly verbose.`

// ── Tool Execution Functions ───────────────────────────────────────────
// Each function returns a string summary of what was done

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)

  switch (name) {
    case 'search_customers': {
      const query = String(args.query || '')
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const customers = await Customer.find({
        $or: [{ name: regex }, { mobile: regex }],
      }).sort({ createdAt: -1 }).limit(10).lean()
      if (customers.length === 0) return `Koi customer nahi mila "${query}" se.`
      return customers.map((c) => `  - ${c.name} | Mobile: ${c.mobile} | ID: ${c._id}`).join('\n')
    }

    case 'create_customer': {
      const { name, mobile, address, gstNumber, creditLimit } = args
      const existing = await Customer.findOne({ mobile: String(mobile) })
      if (existing) return `Customer "${name}" already exists with mobile ${mobile}.`
      const doc = await Customer.create({
        name: String(name),
        mobile: String(mobile),
        address: String(address || ''),
        gstNumber: String(gstNumber || ''),
        creditLimit: Number(creditLimit) || 0,
      })
      return `Customer "${doc.name}" added successfully! Mobile: ${doc.mobile} | ID: ${doc._id}`
    }

    case 'create_daily_sell': {
      const { customerName, amount, date, address, contactNumber, product, quantity, rate, receivedAmount, remarks } = args
      const pendingAmount = (Number(amount) || 0) - (Number(receivedAmount) || 0)
      const doc = await DailySell.create({
        date: normalizeDate(date) || today,
        customerName: String(customerName),
        address: String(address || ''),
        contactNumber: String(contactNumber || ''),
        product: String(product || ''),
        quantity: Number(quantity) || 0,
        rate: Number(rate) || 0,
        amount: Number(amount) || 0,
        receivedAmount: Number(receivedAmount) || 0,
        pendingAmount,
        remarks: String(remarks || ''),
      })
      // Trigger sync in background (non-blocking)
      try {
        const { syncAllFromDailySell } = await import('@/lib/daily-sell-sync')
        await syncAllFromDailySell(doc).catch(() => {}) // best-effort sync
      } catch { /* sync not critical for the response */ }
      return `Daily sell recorded! Customer: ${doc.customerName} | Amount: Rs.${doc.amount.toLocaleString()} | Product: ${doc.product || 'N/A'} | Received: Rs.${doc.receivedAmount.toLocaleString()} | Pending: Rs.${doc.pendingAmount.toLocaleString()}`
    }

    case 'create_production': {
      const data: Record<string, unknown> = { date: normalizeDate(args.date) || today }
      const prodFields = ['cement', 'zigZagGrey80', 'zigZagRed80', 'zigZagYellow80', 'zigZagGrey60', 'zigZagRed60', 'zigZagYellow60', 'curveStone', 'chequreTile', 'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80']
      for (const f of prodFields) {
        if (args[f] !== undefined) data[f] = Number(args[f]) || 0
      }
      data.transportationCharge = Number(args.transportationCharge) || 0
      data.remarks = String(args.remarks || '')
      const doc = await Production.create(data)
      // Sync stock
      try {
        const { syncStockForDate } = await import('@/lib/sync-stock')
        await syncStockForDate(doc.date).catch(() => {})
      } catch {}
      const produced = prodFields.filter((f) => (data[f] as number) > 0).map((f) => `${f}: ${data[f]}`)
      return `Production recorded for ${doc.date}!\n${produced.length > 0 ? produced.join(', ') : 'No quantities specified'}`
    }

    case 'create_customer_payment': {
      const doc = await CustomerPayment.create({
        date: normalizeDate(args.date) || today,
        name: String(args.name),
        address: String(args.address || ''),
        amount: Number(args.amount),
        remarks: String(args.remarks || ''),
      })
      return `Customer payment recorded! Name: ${doc.name} | Amount: Rs.${doc.amount.toLocaleString()} | Date: ${doc.date}`
    }

    case 'create_labour_payment': {
      const doc = await LabourPayment.create({
        date: normalizeDate(args.date) || today,
        name: String(args.name),
        address: String(args.address || ''),
        amount: Number(args.amount),
        remarks: String(args.remarks || ''),
      })
      return `Labour payment recorded! Worker: ${doc.name} | Amount: Rs.${doc.amount.toLocaleString()}`
    }

    case 'create_tractor_payment': {
      const qtyTon = Number(args.quantityTon) || 0
      const rt = Number(args.rate) || 0
      const total = qtyTon * rt
      const paid = Number(args.paidAmount) || 0
      const doc = await TractorPayment.create({
        date: normalizeDate(args.date) || today,
        vendorName: String(args.vendorName),
        quantityTon: qtyTon,
        rate: rt,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: total - paid,
        remarks: String(args.remarks || ''),
      })
      return `Tractor payment recorded! Vendor: ${doc.vendorName} | ${qtyTon} tons @ Rs.${rt}/ton = Rs.${total.toLocaleString()} | Paid: Rs.${paid.toLocaleString()} | Remaining: Rs.${doc.remainingAmount.toLocaleString()}`
    }

    case 'create_dust_purchase': {
      const qty = Number(args.quantity) || 0
      const rt = Number(args.rate) || 0
      const doc = await DustPurchase.create({
        date: normalizeDate(args.date) || today,
        vendorName: String(args.vendorName),
        cementName: String(args.cementName || ''),
        quantity: qty,
        rate: rt,
        totalAmount: qty * rt,
        paidAmount: Number(args.paidAmount) || 0,
        transportationCharge: Number(args.transportationCharge) || 0,
        gst: Number(args.gst) || 0,
        remarks: String(args.remarks || ''),
      })
      return `Dust purchase recorded! Vendor: ${doc.vendorName} | ${qty} units @ Rs.${rt} = Rs.${doc.totalAmount.toLocaleString()}`
    }

    case 'create_cement_purchase': {
      const qty = Number(args.quantity) || 0
      const rt = Number(args.rate) || 0
      const doc = await CementPurchase.create({
        date: normalizeDate(args.date) || today,
        vendorName: String(args.vendorName),
        itemName: String(args.itemName || ''),
        quantity: qty,
        rate: rt,
        totalAmount: qty * rt,
        paidAmount: Number(args.paidAmount) || 0,
        transportationCharge: Number(args.transportationCharge) || 0,
        gst: Number(args.gst) || 0,
        remarks: String(args.remarks || ''),
      })
      return `Cement purchase recorded! Vendor: ${doc.vendorName} | ${qty} bags @ Rs.${rt} = Rs.${doc.totalAmount.toLocaleString()}`
    }

    case 'create_hardner': {
      const doc = await Hardner.create({
        date: normalizeDate(args.date) || today,
        amount: Number(args.amount),
      })
      return `Hardner purchase recorded! Amount: Rs.${doc.amount.toLocaleString()} | Date: ${doc.date}`
    }

    case 'create_electricity': {
      const doc = await Electricity.create({
        date: normalizeDate(args.date) || today,
        name: String(args.name || ''),
        work: String(args.work || ''),
        amount: Number(args.amount),
        remarks: String(args.remarks || ''),
      })
      return `Electricity bill recorded! Amount: Rs.${doc.amount.toLocaleString()}${doc.name ? ` | Name: ${doc.name}` : ''}`
    }

    case 'create_factory_stuff': {
      const doc = await FactoryStuff.create({
        date: normalizeDate(args.date) || today,
        itemName: String(args.itemName),
        quantity: Number(args.quantity) || 0,
        amount: Number(args.amount),
        remarks: String(args.remarks || ''),
      })
      return `Factory stuff recorded! Item: ${doc.itemName} | Amount: Rs.${doc.amount.toLocaleString()}`
    }

    case 'create_expense': {
      const doc = await Expense.create({
        date: normalizeDate(args.date) || today,
        category: String(args.category),
        amount: Number(args.amount),
        description: String(args.description || ''),
      })
      return `Expense recorded! Category: ${doc.category} | Amount: Rs.${doc.amount.toLocaleString()}`
    }

    case 'create_quotation': {
      const items = (args.items as Array<{ description: string; quantity: number; rate: number; unit?: string }>) || []
      if (items.length === 0) return 'Quotation mein kam se kam 1 item hona chahiye.'
      const billItems = items.map((item) => ({
        description: String(item.description),
        quantity: Number(item.quantity) || 1,
        unit: String(item.unit || 'pcs'),
        rate: Number(item.rate) || 0,
        amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
      }))
      const subTotal = billItems.reduce((sum, item) => sum + item.amount, 0)
      const company = await (await import('@/lib/models')).Company.findOne().lean() as Record<string, unknown> | null
      const month = new Date().toISOString().slice(0, 7).replace('-', '')
      const count = await Bill.countDocuments({ billNumber: new RegExp(`^QUOT-${month}`) })
      const billNumber = `QUOT-${month}-${String(count + 1).padStart(4, '0')}`
      const doc = await Bill.create({
        billNumber,
        billType: 'quotation',
        date: today,
        toName: String(args.toName),
        toAddress: String(args.toAddress || ''),
        toGst: String(args.toGst || ''),
        toPhone: String(args.toPhone || ''),
        fromName: String(company?.name || ''),
        fromAddress: String(company?.address || ''),
        fromGst: String(company?.gstNumber || ''),
        fromPhone: String(company?.phone || ''),
        items: billItems,
        subTotal,
        grandTotal: Math.round(subTotal),
        balanceAmount: Math.round(subTotal),
        paymentMode: String(args.paymentMode || 'Cash'),
        notes: String(args.notes || ''),
        status: 'draft',
      })
      const itemLines = billItems.map((it) => `  - ${it.description}: ${it.quantity} ${it.unit} x Rs.${it.rate} = Rs.${it.amount.toLocaleString()}`).join('\n')
      return `Quotation created!\nBill No: ${doc.billNumber}\nCustomer: ${doc.toName}\nItems:\n${itemLines}\nTotal: Rs.${doc.grandTotal.toLocaleString()}`
    }

    case 'get_recent_entries': {
      const module = String(args.module)
      const limit = Math.min(Number(args.limit) || 5, 20)
      let results: string[]
      switch (module) {
        case 'dailySell': {
          const docs = await DailySell.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | ${d.customerName} | Rs.${d.amount.toLocaleString()} | ${d.product || '-'}`)
          break
        }
        case 'production': {
          const docs = await Production.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | Cement: ${d.cement || 0} | ZZ-Grey80: ${d.zigZagGrey80 || 0}`)
          break
        }
        case 'customerPayment': {
          const docs = await CustomerPayment.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | ${d.name} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'labourPayment': {
          const docs = await LabourPayment.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | ${d.name} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'tractorPayment': {
          const docs = await TractorPayment.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | ${d.vendorName} | ${d.quantityTon}T @ Rs.${d.rate} = Rs.${d.totalAmount.toLocaleString()}`)
          break
        }
        case 'bills': {
          const docs = await Bill.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.billNumber} | ${d.billType} | ${d.toName} | Rs.${d.grandTotal.toLocaleString()} | ${d.status}`)
          break
        }
        case 'orders': {
          const docs = await Order.find().populate('customer').sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d: any) => `${d.orderNumber} | ${d.customer?.name || '-'} | Rs.${d.amount.toLocaleString()} | ${d.status}`)
          break
        }
        case 'expenses': {
          const docs = await Expense.find().sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `${d.date} | ${d.category} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        default:
          results = [`Module "${module}" ke liye recent entries abhi available nahi hai.`]
      }
      return `Recent ${module} entries (last ${limit}):\n${results.join('\n')}`
    }

    case 'get_dashboard_summary': {
      const todayStr = today
      const todayProdDocs = await Production.find({ date: todayStr }).lean()
      const totalProduction = todayProdDocs.reduce((sum: number, d: any) => {
        const fields = ['zigZagGrey80','zigZagRed80','zigZagYellow80','zigZagGrey60','zigZagRed60','zigZagYellow60','curveStone','chequreTile','dumbleGrey80','dumbleRed80','dumbleYellow80']
        for (const f of fields) sum += (d[f] as number) || 0
        return sum
      }, 0)
      const todaySells = await DailySell.find({ date: todayStr }).lean()
      const pendingOrders = await Order.countDocuments({ status: 'Pending' })
      const totalSales = todaySells.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
      return `Dashboard Summary (${todayStr}):\n- Aaj ki Production: ${totalProduction.toLocaleString()} pieces\n- Aaj ki Sales: Rs.${totalSales.toLocaleString()} (${todaySells.length} transactions)\n- Pending Orders: ${pendingOrders}`
    }

    default:
      return `Unknown tool: ${name}`
  }
}

// ── Main Route Handler ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await connectDB()
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check AI config — if missing/disabled we STILL work via the built-in
    // ZAI engine (fallback), so the AI agent never hard-fails again.
    const configDoc = await AiConfig.findOne().lean() as Record<string, unknown> | null
    const apiKey = String(configDoc?.openaiApiKey || '')
    const enabled = !!configDoc?.enabled
    const provider = String(configDoc?.provider || 'openai')
    const model = String(configDoc?.model || 'gpt-4o-mini')

    const body = await request.json() as { message: string; conversationId?: string }
    const { message, conversationId: cid } = body
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const convId = cid || `conv_${session.userId}_${Date.now()}`
    const history = getConversation(convId)

    // Add user message to history
    history.push({ role: 'user', content: message.trim() })

    // Build messages for OpenAI
    const apiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    // Create OpenAI client (only when a provider key is configured)
    let client: OpenAI | null = null
    if (enabled && apiKey) {
      const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
        apiKey,
        timeout: 30_000,
        maxRetries: 1,
      }
      if (provider === 'groq') {
        clientOptions.baseURL = 'https://api.groq.com/openai/v1'
      }
      client = new OpenAI(clientOptions)
    }

    // ── Unified completion caller with built-in ZAI fallback ──
    // If the configured provider fails (invalid/revoked key, quota, outage)
    // we transparently switch to the platform ZAI engine for the rest of
    // this request — the AI agent keeps working no matter what.
    let usedFallback = !client
    let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
    const chatCreate = async (body: Record<string, unknown>): Promise<any> => {
      if (client && !usedFallback) {
        try {
          return await client.chat.completions.create(body as never)
        } catch (err: any) {
          const status = err?.status || err?.response?.status
          console.warn(`[AI Agent] provider ${provider} failed (status ${status}): falling back to built-in ZAI engine`)
          usedFallback = true
        }
      }
      if (!zaiInstance) zaiInstance = await ZAI.create()
      // ZAI speaks system/user/assistant only — flatten tool results
      const zaiMessages = (body.messages as any[]).map((m) => {
        if (m.role === 'tool') {
          return { role: 'user' as const, content: `[Tool result] ${m.content}` }
        }
        return { role: m.role, content: m.content }
      })
      const zaiBody: Record<string, unknown> = { messages: zaiMessages }
      if (body.tools) {
        zaiBody.tools = body.tools
        zaiBody.tool_choice = body.tool_choice
      }
      try {
        return await zaiInstance.chat.completions.create(zaiBody as never)
      } catch (err: any) {
        // Some engines reject tools — retry as plain text chat
        if (zaiBody.tools) {
          console.warn(`[AI Agent] ZAI tools rejected (${err?.message || err}), retrying text-only`)
          return zaiInstance.chat.completions.create({ messages: body.messages } as never)
        }
        throw err
      }
    }

    // First API call — may include tool calls
    const response = await chatCreate({
      model,
      messages: apiMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1000,
    })

    const choice = response.choices[0]
    const assistantMsg = choice?.message

    // Handle tool calls (AI wants to execute an action)
    if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
      // Execute all tool calls
      const toolResults: { role: 'tool'; tool_call_id: string; content: string }[] = []
      let actionSummary = ''

      for (const tc of assistantMsg.tool_calls as any[]) {
        const toolName = tc.function.name
        let toolArgs: Record<string, unknown>
        try {
          toolArgs = JSON.parse(tc.function.arguments)
        } catch {
          toolArgs = {}
        }

        try {
          const result = await executeTool(toolName, toolArgs)
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result })
          actionSummary += (actionSummary ? '\n' : '') + result
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: `Error: ${errorMsg}` })
          actionSummary += (actionSummary ? '\n' : '') + `Error in ${toolName}: ${errorMsg}`
        }
      }

      // Send tool results back to AI for a natural language summary
      const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...apiMessages,
        { role: 'assistant', content: assistantMsg.content || '', tool_calls: (assistantMsg.tool_calls as any[]).map((tc) => ({ id: tc.id, type: 'function' as const, function: { name: tc.function.name, arguments: tc.function.arguments } })) },
        ...toolResults,
      ]

      const followUp = await chatCreate({
        model,
        messages: followUpMessages,
        temperature: 0.3,
        max_tokens: 1000,
      })

      const finalText = followUp.choices[0]?.message?.content || 'Kuch gadbad ho gayi.'

      // Save to history
      history.push({ role: 'assistant', content: finalText })

      return NextResponse.json({
        reply: finalText,
        action: { type: 'tool_call', summary: actionSummary },
        conversationId: convId,
      })
    }

    // No tool call — just a text response
    const textReply = assistantMsg?.content || 'Kuch gadbad ho gayi.'
    history.push({ role: 'assistant', content: textReply })

    return NextResponse.json({
      reply: textReply,
      conversationId: convId,
    })
  } catch (error) {
    console.error('[POST /api/ai/agent] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to process'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
