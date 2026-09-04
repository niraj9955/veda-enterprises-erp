import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { makeAiChat } from '@/lib/ai-completions'
import { AiConfig, Customer, DailySell, Production, CustomerPayment, LabourPayment, TractorPayment, DustPurchase, CementPurchase, Hardner, Electricity, FactoryStuff, Expense, Bill, Order, Dispatch, Payment } from '@/lib/models'
import { normalizeDate } from '@/lib/date-utils'
import OpenAI from 'openai'

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
      description: 'Get recent entries from any module (WITH entry IDs needed for update/delete). Use the search parameter to find a specific entry by customer/product/vendor name or bill number.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['dailySell', 'production', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'expenses', 'orders', 'bills'], description: 'Which module to fetch from' },
          limit: { type: 'number', description: 'Number of entries to return (default 5, max 20)' },
          search: { type: 'string', description: 'Optional filter text — customer/product/vendor name, bill number, category etc.' },
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
  {
    type: 'function',
    function: {
      name: 'get_customer_balance',
      description: "Get a customer's ledger summary: total ordered amount, total paid, and pending balance (bakaya). Use for 'Rohit ka bakaya kitna hai' type questions.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Customer name or mobile number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Create a new order for an EXISTING customer. Needs customer name, brick/product type, and quantity+rate or total amount. Delivery date defaults to today.',
      parameters: {
        type: 'object',
        properties: {
          customer: { type: 'string', description: 'Existing customer name or mobile number' },
          brickType: { type: 'string', description: 'Product type, e.g. Zig Zag Grey 80mm' },
          quantity: { type: 'number' },
          rate: { type: 'number', description: 'Rate per piece' },
          amount: { type: 'number', description: 'Total amount (if not quantity*rate)' },
          deliveryDate: { type: 'string', description: 'YYYY-MM-DD delivery date' },
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'] },
        },
        required: ['customer', 'brickType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_bill',
      description: 'Create a SALES invoice (NOT quotation) for a party with line items. Use when the user says bill/invoice banao. Status auto-set from paidAmount.',
      parameters: {
        type: 'object',
        properties: {
          toName: { type: 'string' },
          toPhone: { type: 'string' },
          toAddress: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                rate: { type: 'number' },
              },
              required: ['description', 'quantity', 'rate'],
            },
          },
          paidAmount: { type: 'number', description: 'Amount already received (0 if unpaid)' },
          paymentMode: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['toName', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_entry',
      description: 'Update specific fields of an existing entry by ID. FIRST use get_recent_entries (with search) to find the entry and get its ID. Bills, Orders and Customers are NOT updateable here.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'expense', 'production'] },
          id: { type: 'string', description: 'Entry _id exactly as returned by get_recent_entries' },
          fields: { type: 'object', description: 'Fields to change, e.g. { "amount": 5000, "remarks": "corrected" }', additionalProperties: true },
        },
        required: ['module', 'id', 'fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_entry',
      description: 'PERMANENTLY delete an entry by ID. ALWAYS show the entry first, ask "Pakka delete karu?" and wait for a clear yes BEFORE calling this. Bills, Orders and Customers are NOT deleteable here.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'expense', 'production'] },
          id: { type: 'string', description: 'Entry _id exactly as returned by get_recent_entries' },
        },
        required: ['module', 'id'],
      },
    },
  },
]

const SYSTEM_PROMPT = `You are the AI assistant for Veda Enterprises ERP — a paver block manufacturing business in India. You can perform real actions in the system using tools.

YOUR CAPABILITIES (FULL ACCESS):
- Create entries in ANY module: Daily Sell, Production, Customer Payment, Labour Payment, Tractor Payment, Dust Purchase, Cement Purchase, Hardner, Electricity, Factory Stuff, Expenses
- Create Quotations, SALES Bills (invoices), and Orders for customers
- Search customers by name or mobile; check any customer's pending balance/bakaya (get_customer_balance)
- View recent entries from any module — results include entry IDs
- UPDATE entries (update_entry) and DELETE entries (delete_entry) for: dailySell, customerPayment, labourPayment, tractorPayment, dustPurchase, cementPurchase, hardner, electricity, factoryStuff, expense, production
- Get dashboard summary (today's stats)

IMPORTANT RULES:
1. Speak in the SAME LANGUAGE the user uses (Hindi/Hinglish → Hinglish, English → English)
2. Before creating an entry, if the user hasn't provided all required info, ASK them for the missing details. Don't guess critical values.
3. For dates: if user says "aaj/today" use today's date, "kal/yesterday" use yesterday. Always use YYYY-MM-DD format internally.
4. For amounts in Hindi: "ek"=1, "do"=2, "teen"=3, "char"=4, "panch"=5, "chhe"=6, "saat"=7, "aath"=8, "nau"=9, "das"=10, "sau"=100, "hazaar"=1000, "lakh"=100000
5. Be conversational and helpful. After performing an action, confirm what was done with key details.
6. UPDATE/DELETE safety: FIRST find the entry via get_recent_entries (use the search parameter, e.g. customer name) and SHOW it to the user. If the user ALREADY gives the full 24-character entry ID, get_recent_entries(search=ID) will find it directly. For DELETE, always ask "Pakka delete karu?" and wait for a clear yes ("haan", "yes", "delete karo") BEFORE calling delete_entry — but if the user's message already contains a clear confirmation ("pakka", "delete kar do", "haan delete"), you may proceed in the same turn. NEVER invent IDs — use only IDs exactly as returned by get_recent_entries or given verbatim by the user. For UPDATE: if the user already gave the exact field+value (e.g. "amount 222 kar do"), call update_entry DIRECTLY in the same turn — no extra confirmation; only confirm when the request is ambiguous. Bills, Orders aur Customers in tools se update/delete NAHI hote — us case me user ko respective module me bhejo.
7. Today's date is ${new Date().toISOString().slice(0, 10)}.
8. When creating a daily sell, if the user mentions a product and rate but not quantity, calculate quantity = amount / rate. If they mention quantity and rate but not amount, calculate amount = quantity * rate.
9. Keep responses concise but informative. Don't be overly verbose.`

// ── Tool Execution Functions ───────────────────────────────────────────
// Each function returns a string summary of what was done

// ── Full-access entry registry (update/delete whitelist) ──────────────
// Bills, Orders and Customers are deliberately EXCLUDED from update/delete —
// they have linked records (payments sync, dispatches, order references) that
// must go through the app's own routes to stay consistent.
type EntryModelCfg = {
  model: any
  label: string
  fields: Record<string, 'string' | 'number' | 'date'>
  /** Derived totals recomputed from the merged doc after whitelisted edits. */
  recompute?: (merged: Record<string, any>) => Record<string, unknown>
}

const PRODUCT_QTY_FIELDS = {
  zigZagGrey80: 'number', zigZagRed80: 'number', zigZagYellow80: 'number',
  zigZagGrey60: 'number', zigZagRed60: 'number', zigZagYellow60: 'number',
  curveStone: 'number', chequreTile: 'number',
  dumbleGrey80: 'number', dumbleRed80: 'number', dumbleYellow80: 'number',
} as const

const ENTRY_MODELS: Record<string, EntryModelCfg> = {
  dailySell: {
    model: DailySell, label: 'Daily Sell',
    fields: { date: 'date', customerName: 'string', address: 'string', contactNumber: 'string', product: 'string', quantity: 'number', rate: 'number', amount: 'number', receivedAmount: 'number', remarks: 'string' },
    recompute: (m) => ({ pendingAmount: (Number(m.amount) || 0) - (Number(m.receivedAmount) || 0) }),
  },
  customerPayment: { model: CustomerPayment, label: 'Customer Payment', fields: { date: 'date', name: 'string', address: 'string', amount: 'number', remarks: 'string' } },
  labourPayment: { model: LabourPayment, label: 'Labour Payment', fields: { date: 'date', name: 'string', address: 'string', amount: 'number', remarks: 'string' } },
  tractorPayment: {
    model: TractorPayment, label: 'Tractor Payment',
    fields: { date: 'date', vendorName: 'string', quantityTon: 'number', rate: 'number', paidAmount: 'number', remarks: 'string' },
    recompute: (m) => {
      const total = (Number(m.quantityTon) || 0) * (Number(m.rate) || 0)
      return { totalAmount: total, remainingAmount: total - (Number(m.paidAmount) || 0) }
    },
  },
  dustPurchase: {
    model: DustPurchase, label: 'Dust Purchase',
    fields: { date: 'date', vendorName: 'string', quantity: 'number', rate: 'number', paidAmount: 'number', transportationCharge: 'number', gst: 'number', remarks: 'string' },
    recompute: (m) => ({ totalAmount: (Number(m.quantity) || 0) * (Number(m.rate) || 0) }),
  },
  cementPurchase: {
    model: CementPurchase, label: 'Cement Purchase',
    fields: { date: 'date', vendorName: 'string', itemName: 'string', quantity: 'number', rate: 'number', paidAmount: 'number', transportationCharge: 'number', gst: 'number', remarks: 'string' },
    recompute: (m) => ({ totalAmount: (Number(m.quantity) || 0) * (Number(m.rate) || 0) }),
  },
  hardner: { model: Hardner, label: 'Hardner', fields: { date: 'date', amount: 'number' } },
  electricity: { model: Electricity, label: 'Electricity', fields: { date: 'date', name: 'string', work: 'string', amount: 'number', remarks: 'string' } },
  factoryStuff: { model: FactoryStuff, label: 'Factory Stuff', fields: { date: 'date', itemName: 'string', quantity: 'number', amount: 'number', remarks: 'string' } },
  expense: { model: Expense, label: 'Expense', fields: { date: 'date', category: 'string', amount: 'number', description: 'string' } },
  production: { model: Production, label: 'Production', fields: { date: 'date', ...PRODUCT_QTY_FIELDS } },
}

function castField(kind: 'string' | 'number' | 'date', v: unknown): unknown {
  if (kind === 'number') return Number(v) || 0
  if (kind === 'date') return normalizeDate(String(v)) || String(v)
  return String(v ?? '')
}

/** Find a customer by exact name → mobile → partial name (fuzzy). */
async function findCustomerFlexible(query: string) {
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let c: any = await Customer.findOne({ $or: [{ name: new RegExp(`^${esc}$`, 'i') }, { mobile: new RegExp(esc, 'i') }] }).lean()
  if (!c) c = await Customer.findOne({ name: new RegExp(esc, 'i') }).lean()
  return c
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)

  switch (name) {
    case 'search_customers': {
      const query = String(args.query || '').trim()
      const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      let customers = await Customer.find({
        $or: [{ name: new RegExp(esc, 'i') }, { mobile: new RegExp(esc, 'i') }],
      }).sort({ createdAt: -1 }).limit(10).lean()
      // Fuzzy fallback — voice transcripts are noisy ("rohit kumar" vs stored
      // "Rohit", extra filler words). Match customers whose name contains
      // EVERY query token so partial/multi-word spoken names still hit.
      if (customers.length === 0 && query.includes(' ')) {
        const tokens = query.split(/\s+/).filter((t) => t.length >= 2)
        if (tokens.length > 1) {
          customers = await Customer.find({
            $and: tokens.map((t) => ({ name: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })),
          }).sort({ createdAt: -1 }).limit(10).lean()
        }
      }
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
      // LLM may use singular/plural interchangeably — normalize aliases.
      const ALIASES: Record<string, string> = {
        expense: 'expenses', bill: 'bills', order: 'orders', dailysell: 'dailySell',
        customerpayment: 'customerPayment', labourpayment: 'labourPayment', tractorpayment: 'tractorPayment',
        dustpurchase: 'dustPurchase', cementpurchase: 'cementPurchase', factorystuff: 'factoryStuff',
      }
      const module = ALIASES[String(args.module).toLowerCase()] || String(args.module)
      const limit = Math.min(Number(args.limit) || 5, 20)
      const search = String(args.search || '').trim()
      const escS = search ? search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
      const rx = escS ? new RegExp(escS, 'i') : null
      // Fast path: search is a raw ObjectId (user pasted/spoke an ID for
      // update/delete) — match _id directly on the module model, otherwise
      // text-only filters would miss it and the AI would think the entry
      // doesn't exist.
      const isId = /^[a-f\d]{24}$/i.test(search)
      // NOTE: registry keys are singular ('expense') while list keys are
      // plural ('expenses') — try the naive singular form too.
      const regCfg = ENTRY_MODELS[module] || ENTRY_MODELS[module.replace(/s$/, '')]
      let results: string[]
      if (isId && regCfg) {
        const cfg2 = regCfg
        const doc = await cfg2.model.findById(search).lean()
        if (!doc) {
          results = [`ID "${search}" se koi ${cfg2.label} entry nahi mili.`]
        } else {
          const d: any = doc
          const who = d.customerName || d.name || d.vendorName || d.category || d.itemName || d.work || ''
          const amt = Number(d.amount ?? d.totalAmount ?? 0)
          results = [`ID: ${d._id} | ${d.date || ''} | ${who || cfg2.label} | Rs.${amt.toLocaleString()}`]
        }
      } else if (isId && module === 'bills') {
        const doc = await Bill.findById(search).lean()
        results = doc ? [`ID: ${doc._id} | ${doc.billNumber} | ${doc.billType} | ${doc.toName} | Rs.${doc.grandTotal.toLocaleString()} | ${doc.status}`] : [`ID "${search}" se koi bill nahi mila.`]
      } else if (isId && module === 'orders') {
        const doc = await Order.findById(search).populate('customer').lean() as any
        results = doc ? [`ID: ${doc._id} | ${doc.orderNumber} | ${doc.customer?.name || '-'} | Rs.${doc.amount.toLocaleString()} | ${doc.status}`] : [`ID "${search}" se koi order nahi mila.`]
      } else {
        results = []
      }
      if (!results.length) {
      switch (module) {
        case 'dailySell': {
          const docs = await DailySell.find(rx ? { $or: [{ customerName: rx }, { product: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.customerName} | Rs.${d.amount.toLocaleString()} | ${d.product || '-'}`)
          break
        }
        case 'production': {
          const docs = await Production.find(escS ? { date: { $regex: escS, $options: 'i' } } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | Cement: ${d.cement || 0} | ZZ-Grey80: ${d.zigZagGrey80 || 0}`)
          break
        }
        case 'customerPayment': {
          const docs = await CustomerPayment.find(rx ? { $or: [{ name: rx }, { remarks: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.name} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'labourPayment': {
          const docs = await LabourPayment.find(rx ? { $or: [{ name: rx }, { remarks: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.name} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'tractorPayment': {
          const docs = await TractorPayment.find(rx ? { vendorName: rx } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.vendorName} | ${d.quantityTon}T @ Rs.${d.rate} = Rs.${d.totalAmount.toLocaleString()}`)
          break
        }
        case 'dustPurchase': {
          const docs = await DustPurchase.find(rx ? { $or: [{ vendorName: rx }, { cementName: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.vendorName} | Rs.${d.totalAmount.toLocaleString()}`)
          break
        }
        case 'cementPurchase': {
          const docs = await CementPurchase.find(rx ? { $or: [{ vendorName: rx }, { itemName: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.vendorName} | ${d.itemName || '-'} | Rs.${d.totalAmount.toLocaleString()}`)
          break
        }
        case 'hardner': {
          const docs = await Hardner.find({}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'electricity': {
          const docs = await Electricity.find(rx ? { $or: [{ name: rx }, { work: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.name || '-'} | ${d.work || '-'} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'factoryStuff': {
          const docs = await FactoryStuff.find(rx ? { itemName: rx } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.itemName} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'expenses': {
          const filter = rx ? { $or: [{ category: rx }, { description: rx }] } : {}
          const docs = await Expense.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.date} | ${d.category} | Rs.${d.amount.toLocaleString()}`)
          break
        }
        case 'bills': {
          const docs = await Bill.find(rx ? { $or: [{ toName: rx }, { billNumber: rx }] } : {}).sort({ createdAt: -1 }).limit(limit).lean()
          results = docs.map((d) => `ID: ${d._id} | ${d.billNumber} | ${d.billType} | ${d.toName} | Rs.${d.grandTotal.toLocaleString()} | ${d.status}`)
          break
        }
        case 'orders': {
          const docs = await Order.find({}).populate('customer').sort({ createdAt: -1 }).limit(limit).lean()
          let list = docs.map((d: any) => `ID: ${d._id} | ${d.orderNumber} | ${d.customer?.name || '-'} | Rs.${d.amount.toLocaleString()} | ${d.status}`)
          if (rx) list = list.filter((l) => rx.test(l))
          results = list
          break
        }
        default:
          results = [`Module "${module}" ke liye recent entries abhi available nahi hai.`]
      }
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

    case 'get_customer_balance': {
      const query = String(args.query || '').trim()
      const customer = await findCustomerFlexible(query)
      if (!customer) return `Koi customer nahi mila "${query}" se.`
      const cname = String(customer.name || '').trim()
      const [orders, payments, customerPayments] = await Promise.all([
        Order.find({ customerId: customer._id }).lean(),
        Payment.find({ customerId: customer._id }).lean(),
        CustomerPayment.find({ name: cname }).lean(),
      ])
      const totalOrdered = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0)
      const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
        + customerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const balance = totalOrdered - totalPaid
      const recent = [...customerPayments].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3)
        .map((p) => `  - ${p.date}: Rs.${(Number(p.amount) || 0).toLocaleString()}`).join('\n')
      return `Customer: ${cname} | Mobile: ${customer.mobile}\nTotal Ordered: Rs.${totalOrdered.toLocaleString()}\nTotal Paid: Rs.${totalPaid.toLocaleString()}\nBakaya (Balance): Rs.${balance.toLocaleString()}${recent ? `\nRecent payments:\n${recent}` : ''}`
    }

    case 'create_order': {
      const customer = await findCustomerFlexible(String(args.customer || ''))
      if (!customer) return `Customer "${args.customer}" nahi mila. Pehle search_customers se sahi naam confirm karo.`
      const quantity = Number(args.quantity) || 0
      const rate = Number(args.rate) || 0
      const amount = Number(args.amount) || quantity * rate
      if (!amount) return 'Order ke liye amount ya quantity+rate chahiye.'
      const { Company } = await import('@/lib/models')
      const company = await Company.findOne({}).lean() as Record<string, unknown> | null
      const count = await Order.countDocuments({})
      const prefix = String(company?.orderPrefix || 'ORD')
      const doc = await Order.create({
        orderNumber: `${prefix}-${String(count + 1).padStart(4, '0')}`,
        customerId: customer._id,
        brickType: String(args.brickType || ''),
        quantity,
        rate,
        amount,
        deliveryDate: normalizeDate(args.deliveryDate) || today,
        status: String(args.status || 'Pending'),
      })
      return `Order created! ${doc.orderNumber} | ${customer.name} | ${doc.brickType} | ${doc.quantity} qty @ Rs.${doc.rate} = Rs.${doc.amount.toLocaleString()} | Delivery: ${doc.deliveryDate} | Status: ${doc.status}`
    }

    case 'create_bill': {
      const items = (args.items as Array<{ description: string; quantity: number; rate: number; unit?: string }>) || []
      if (items.length === 0) return 'Bill mein kam se kam 1 item hona chahiye.'
      const billItems = items.map((item) => ({
        description: String(item.description),
        quantity: Number(item.quantity) || 1,
        unit: String(item.unit || 'pcs'),
        rate: Number(item.rate) || 0,
        amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
      }))
      const subTotal = billItems.reduce((sum, item) => sum + item.amount, 0)
      const grandTotal = Math.round(subTotal)
      const paid = Number(args.paidAmount) || 0
      const company = await (await import('@/lib/models')).Company.findOne().lean() as Record<string, unknown> | null
      const now = new Date()
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const count = await Bill.countDocuments({ billType: { $ne: 'quotation' } })
      const doc = await Bill.create({
        billNumber: `BILL-${yyyymm}-${String(count + 1).padStart(4, '0')}`,
        billType: 'sales',
        date: today,
        toName: String(args.toName),
        toAddress: String(args.toAddress || ''),
        toPhone: String(args.toPhone || ''),
        fromName: String(company?.name || ''),
        fromAddress: String(company?.address || ''),
        fromGst: String(company?.gstNumber || ''),
        fromPhone: String(company?.phone || ''),
        items: billItems,
        subTotal,
        grandTotal,
        paidAmount: paid,
        balanceAmount: grandTotal - paid,
        paymentMode: String(args.paymentMode || 'Cash'),
        notes: String(args.notes || ''),
        status: paid >= grandTotal && grandTotal > 0 ? 'paid' : paid > 0 ? 'partial' : 'sent',
      })
      const itemLines = billItems.map((it) => `  - ${it.description}: ${it.quantity} ${it.unit} x Rs.${it.rate} = Rs.${it.amount.toLocaleString()}`).join('\n')
      return `Sales bill created!\nBill No: ${doc.billNumber}\nParty: ${doc.toName}\nItems:\n${itemLines}\nTotal: Rs.${doc.grandTotal.toLocaleString()} | Paid: Rs.${paid.toLocaleString()} | Balance: Rs.${doc.balanceAmount.toLocaleString()}`
    }

    case 'update_entry': {
      const cfg = ENTRY_MODELS[String(args.module)]
      if (!cfg) return `Module "${args.module}" update ke liye allowed nahi hai. Allowed: ${Object.keys(ENTRY_MODELS).join(', ')}. Bills/Orders/Customers app ke module se update karo.`
      const id = String(args.id || '')
      if (!/^[a-f\d]{24}$/i.test(id)) return 'Invalid entry ID. Pehle get_recent_entries se entry dhundo aur uska exact ID lo.'
      const fields = (args.fields as Record<string, unknown>) || {}
      if (Object.keys(fields).length === 0) return 'Koi field nahi di gayi update karne ke liye.'
      const existing = await cfg.model.findById(id).lean()
      if (!existing) return `${cfg.label} entry ID ${id} nahi mili.`
      const update: Record<string, unknown> = {}
      const skipped: string[] = []
      for (const [k, v] of Object.entries(fields)) {
        const kind = cfg.fields[k]
        if (!kind) { skipped.push(k); continue }
        update[k] = castField(kind, v)
      }
      if (Object.keys(update).length === 0) return `Ye fields update nahi ho sakti: ${skipped.join(', ')}. Allowed: ${Object.keys(cfg.fields).join(', ')}.`
      const merged = { ...(existing as Record<string, any>), ...update }
      if (cfg.recompute) Object.assign(update, cfg.recompute(merged))
      await cfg.model.findByIdAndUpdate(id, update)
      return `${cfg.label} entry updated! ID: ${id} | Changed: ${Object.entries(update).map(([k, v]) => `${k}=${String(v)}`).join(', ')}`
    }

    case 'delete_entry': {
      const cfg = ENTRY_MODELS[String(args.module)]
      if (!cfg) return `Module "${args.module}" delete ke liye allowed nahi hai. Bills, Orders aur Customers app ke module se hi delete karo (linked records safe rete hain).`
      const id = String(args.id || '')
      if (!/^[a-f\d]{24}$/i.test(id)) return 'Invalid entry ID. Pehle get_recent_entries se entry dhundo aur uska exact ID lo.'
      const doc = await cfg.model.findById(id).lean()
      if (!doc) return `${cfg.label} entry ID ${id} nahi mili (shayad pehle hi delete ho chuki hai).`
      await cfg.model.findByIdAndDelete(id)
      return `${cfg.label} entry DELETED! ID: ${id}`
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

    // Unified AI layer — stored provider first, built-in ZAI engine as
    // automatic fallback. A missing/invalid/expired key can NEVER break the
    // agent again (see src/lib/ai-completions.ts).
    const ai = await makeAiChat()
    const model = ai.model

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

    // First API call — may include tool calls
    const response = await ai.create({
      model,
      messages: apiMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 500, // tool-call args are short JSON — 500 keeps prefill+decode snappy
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

      const followUp = await ai.create({
        model,
        messages: followUpMessages,
        temperature: 0.3,
        max_tokens: 400, // Hindi summary is short — lower cap = faster reply
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
