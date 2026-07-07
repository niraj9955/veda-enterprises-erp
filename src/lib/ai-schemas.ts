// ─── AI Form-Fill Module Schemas ────────────────────────────────────────────
//
// Defines the field schema for every ERP module that supports AI form-fill.
// The /api/ai/parse route uses these schemas to:
//   1. Build a system prompt for OpenAI describing what fields exist
//   2. Validate the JSON response from the model
//   3. Coerce values to the correct type before returning to the client
//
// Each field has:
//   • key    — the schema field name (matches the DB model + form state key)
//   • label  — human-readable label shown in the AI preview UI
//   • type   — 'string' | 'number' | 'date' | 'phone' (controls coercion)
//   • aliases — alternative names the AI should recognize in natural language
//               (e.g., 'amount' → 'paisa', 'rate', 'kimat', 'dam')
//   • required — whether the field is mandatory (for UI highlighting)
//
// IMPORTANT: keep this list in sync with the Mongoose schemas in
// src/lib/models.ts and the form state shapes in each *-module.tsx file.

export type AiFieldType = 'string' | 'number' | 'date' | 'phone'

export interface AiField {
  key: string
  label: string
  type: AiFieldType
  aliases: string[]
  required?: boolean
  // For number fields with units, hint to the AI what unit it represents
  // (e.g., 'bags', 'pieces', '₹'). Purely informational — affects the prompt.
  unit?: string
  // For fields that accept a fixed set of values, list them so the AI
  // can map synonyms to the canonical value (e.g., paymentMode: ['Cash', 'UPI', 'Bank'])
  enum?: string[]
}

export interface AiModuleSchema {
  // The module key — matches ModuleKey in src/lib/store.ts (or 'customer' for the
  // customer add form, which lives inside customer-module.tsx)
  key: string
  label: string
  // Short description of what this module does — helps the AI understand context
  description: string
  fields: AiField[]
}

export const AI_MODULE_SCHEMAS: AiModuleSchema[] = [
  // ── Daily Sell ───────────────────────────────────────────────────────────
  {
    key: 'dailySell',
    label: 'Daily Sell',
    description:
      'Daily sales transactions — when a customer buys paver blocks, cement, or any product. Records customer name, address, contact, product description, and the sale amount in rupees.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'customerName', label: 'Customer Name', type: 'string', aliases: ['customer', 'name', 'naam', 'graahak', 'party', 'khareedar'], required: true },
      { key: 'address', label: 'Address', type: 'string', aliases: ['address', 'pata', 'address', ' jagah', 'location'] },
      { key: 'contactNumber', label: 'Contact Number', type: 'phone', aliases: ['contact', 'mobile', 'phone', 'number', 'phone number', 'sampark'] },
      { key: 'product', label: 'Product', type: 'string', aliases: ['product', 'item', 'samagri', 'maal', 'cheez', 'brick', 'block', 'tile', 'cement'] },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'kimat', 'dam', 'rate', 'price', 'total', 'bill'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani', 'comment'] },
    ],
  },

  // ── Production ───────────────────────────────────────────────────────────
  {
    key: 'production',
    label: 'Production',
    description:
      'Daily paver block production entries — how many units of each product type were manufactured on a given date. Products include cement, zig zag (grey/red/yellow, 80mm/60mm), chequre tile, curve stone, and dumble (grey/red/yellow). All quantities are in pieces unless stated otherwise.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'cement', label: 'Cement (bags)', type: 'number', unit: 'bags', aliases: ['cement', 'sement', 'cement bags'] },
      { key: 'zigZagGrey80', label: 'Zig Zag Grey 80mm', type: 'number', unit: 'pieces', aliases: ['zigzag grey 80', 'zig zag grey 80', 'grey 80', 'zigzag grey'] },
      { key: 'zigZagRed80', label: 'Zig Zag Red 80mm', type: 'number', unit: 'pieces', aliases: ['zigzag red 80', 'zig zag red 80', 'red 80', 'zigzag red'] },
      { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80mm', type: 'number', unit: 'pieces', aliases: ['zigzag yellow 80', 'zig zag yellow 80', 'yellow 80', 'zigzag yellow'] },
      { key: 'zigZagGrey60', label: 'Zig Zag Grey 60mm', type: 'number', unit: 'pieces', aliases: ['zigzag grey 60', 'zig zag grey 60', 'grey 60'] },
      { key: 'zigZagRed60', label: 'Zig Zag Red 60mm', type: 'number', unit: 'pieces', aliases: ['zigzag red 60', 'zig zag red 60', 'red 60'] },
      { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60mm', type: 'number', unit: 'pieces', aliases: ['zigzag yellow 60', 'zig zag yellow 60', 'yellow 60'] },
      { key: 'chequreTile', label: 'Chequre Tile', type: 'number', unit: 'pieces', aliases: ['chequre tile', 'chequer tile', 'check tile', 'chequre'] },
      { key: 'curveStone', label: 'Curve Stone', type: 'number', unit: 'pieces', aliases: ['curve stone', 'curvestone', 'curve'] },
      { key: 'dumbleGrey80', label: 'Dumble Grey 80mm', type: 'number', unit: 'pieces', aliases: ['dumble grey 80', 'grey dumble 80', 'dumble grey'] },
      { key: 'dumbleRed80', label: 'Dumble Red 80mm', type: 'number', unit: 'pieces', aliases: ['dumble red 80', 'red dumble 80', 'dumble red'] },
      { key: 'dumbleYellow80', label: 'Dumble Yellow 80mm', type: 'number', unit: 'pieces', aliases: ['dumble yellow 80', 'yellow dumble 80', 'dumble yellow'] },
      { key: 'transportationCharge', label: 'Transport Charge (₹)', type: 'number', unit: '₹', aliases: ['transport', 'transportation', 'bhada', 'kiraya', 'loading', 'freight'] },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani', 'comment'] },
    ],
  },

  // ── Customer Payment ─────────────────────────────────────────────────────
  {
    key: 'customerPayment',
    label: 'Customer Payment',
    description:
      'Payments received from customers — when a customer pays money against their outstanding balance. Records the date, customer name, address, payment amount in rupees, and optional remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'name', label: 'Customer Name', type: 'string', aliases: ['name', 'naam', 'customer', 'graahak', 'party'], required: true },
      { key: 'address', label: 'Address', type: 'string', aliases: ['address', 'pata', 'location'] },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'kimat', 'dam', 'rate', 'payment', 'jama'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani', 'mode', 'cash', 'upi', 'bank'] },
    ],
  },

  // ── Customer (Add) ───────────────────────────────────────────────────────
  {
    key: 'customer',
    label: 'Add Customer',
    description: 'Create a new customer record — name, mobile number, optional GST number and address, and an optional credit limit in rupees.',
    fields: [
      { key: 'name', label: 'Customer Name', type: 'string', aliases: ['name', 'naam', 'customer', 'party'], required: true },
      { key: 'mobile', label: 'Mobile Number', type: 'phone', aliases: ['mobile', 'phone', 'contact', 'number', 'sampark'], required: true },
      { key: 'gstNumber', label: 'GST Number', type: 'string', aliases: ['gst', 'gst number', 'gst no'] },
      { key: 'address', label: 'Address', type: 'string', aliases: ['address', 'pata', 'location'] },
      { key: 'creditLimit', label: 'Credit Limit (₹)', type: 'number', unit: '₹', aliases: ['credit limit', 'limit', 'udhaar limit', 'max credit'] },
    ],
  },

  // ── Labour Payment ───────────────────────────────────────────────────────
  {
    key: 'labourPayment',
    label: 'Labour Payment',
    description: 'Payments made to labour workers — records the date, worker name, address, amount paid in rupees, and optional remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'name', label: 'Worker Name', type: 'string', aliases: ['name', 'naam', 'labour', 'mazdoor', 'worker', 'aadmee'], required: true },
      { key: 'address', label: 'Address', type: 'string', aliases: ['address', 'pata', 'location'] },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'payment', 'jama', 'vetan', 'tankhwa'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },

  // ── Tractor Payment ──────────────────────────────────────────────────────
  {
    key: 'tractorPayment',
    label: 'Tractor Payment',
    description:
      'Payments to tractor/dumper vendors who supply dust or material — records date, vendor name, quantity in tons, rate per ton, total amount, paid amount, and remaining balance.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'vendorName', label: 'Vendor Name', type: 'string', aliases: ['vendor', 'name', 'naam', 'tractor wala', 'driver', 'malik'], required: true },
      { key: 'quantityTon', label: 'Quantity (tons)', type: 'number', unit: 'tons', aliases: ['quantity', 'ton', 'tan', 'maal', 'bhaar', 'weight'], required: true },
      { key: 'rate', label: 'Rate per ton (₹)', type: 'number', unit: '₹/ton', aliases: ['rate', 'dar', 'kimat', 'price per ton', 'per ton'] },
      { key: 'totalAmount', label: 'Total Amount (₹)', type: 'number', unit: '₹', aliases: ['total', 'kul', 'total amount', 'billed'] },
      { key: 'paidAmount', label: 'Paid Amount (₹)', type: 'number', unit: '₹', aliases: ['paid', 'jama', 'pay kiya', 'de diya'] },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },

  // ── Dust Purchase ────────────────────────────────────────────────────────
  {
    key: 'dustPurchase',
    label: 'Dust Purchase',
    description:
      'Purchases of dust (raw material) from vendors — records date, vendor name, cement brand name, quantity, rate, total amount, paid amount, transport charge, GST, and remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'vendorName', label: 'Vendor Name', type: 'string', aliases: ['vendor', 'name', 'naam', 'party'], required: true },
      { key: 'cementName', label: 'Cement/Brand Name', type: 'string', aliases: ['cement name', 'brand', 'brand name', 'company'] },
      { key: 'quantity', label: 'Quantity', type: 'number', aliases: ['quantity', 'maatra', 'ton', 'bags', 'bhaar'], required: true },
      { key: 'rate', label: 'Rate (₹)', type: 'number', unit: '₹', aliases: ['rate', 'dar', 'per unit'] },
      { key: 'totalAmount', label: 'Total Amount (₹)', type: 'number', unit: '₹', aliases: ['total', 'kul', 'total amount'] },
      { key: 'paidAmount', label: 'Paid Amount (₹)', type: 'number', unit: '₹', aliases: ['paid', 'jama', 'pay'] },
      { key: 'transportationCharge', label: 'Transport Charge (₹)', type: 'number', unit: '₹', aliases: ['transport', 'bhada', 'kiraya', 'freight'] },
      { key: 'gst', label: 'GST (₹)', type: 'number', unit: '₹', aliases: ['gst', 'tax'] },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },

  // ── Cement Purchase ──────────────────────────────────────────────────────
  {
    key: 'cementPurchase',
    label: 'Cement Purchase',
    description:
      'Purchases of cement bags from vendors — records date, vendor name, item/brand name, quantity (bags), rate, total amount, paid amount, transport charge, GST, and remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'vendorName', label: 'Vendor Name', type: 'string', aliases: ['vendor', 'name', 'naam', 'party'], required: true },
      { key: 'itemName', label: 'Item / Brand', type: 'string', aliases: ['item', 'brand', 'cement name', 'ultratech', 'ambuja', 'birla'] },
      { key: 'quantity', label: 'Quantity (bags)', type: 'number', unit: 'bags', aliases: ['quantity', 'bags', 'bhaar', 'maatra'], required: true },
      { key: 'rate', label: 'Rate per bag (₹)', type: 'number', unit: '₹', aliases: ['rate', 'dar', 'per bag'] },
      { key: 'totalAmount', label: 'Total Amount (₹)', type: 'number', unit: '₹', aliases: ['total', 'kul', 'total amount'] },
      { key: 'paidAmount', label: 'Paid Amount (₹)', type: 'number', unit: '₹', aliases: ['paid', 'jama'] },
      { key: 'transportationCharge', label: 'Transport Charge (₹)', type: 'number', unit: '₹', aliases: ['transport', 'bhada', 'kiraya'] },
      { key: 'gst', label: 'GST (₹)', type: 'number', unit: '₹', aliases: ['gst', 'tax'] },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },

  // ── Hardner ──────────────────────────────────────────────────────────────
  {
    key: 'hardner',
    label: 'Hardner',
    description: 'Hardner chemical purchase entries — date and amount in rupees only.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'total', 'kimat'], required: true },
    ],
  },

  // ── Electricity ──────────────────────────────────────────────────────────
  {
    key: 'electricity',
    label: 'Electricity',
    description: 'Electricity bill payments — date, name/purpose, work description, amount, and remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'name', label: 'Name', type: 'string', aliases: ['name', 'naam', 'bill', 'connection'] },
      { key: 'work', label: 'Work', type: 'string', aliases: ['work', 'purpose', 'kaam', 'kaaran'] },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'bill', 'total'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },

  // ── Factory Stuff ────────────────────────────────────────────────────────
  {
    key: 'factoryStuff',
    label: 'Factory Stuff',
    description: 'Factory consumables/equipment purchases — date, item name, quantity, amount, remarks.',
    fields: [
      { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'din', 'tarikh', 'aaj', 'kal'], required: true },
      { key: 'itemName', label: 'Item Name', type: 'string', aliases: ['item', 'samagri', 'cheez', 'naam'], required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', aliases: ['quantity', 'maatra', 'kitna'] },
      { key: 'amount', label: 'Amount (₹)', type: 'number', unit: '₹', aliases: ['amount', 'paisa', 'kimat', 'total'], required: true },
      { key: 'remarks', label: 'Remarks', type: 'string', aliases: ['remarks', 'note', 'tippani'] },
    ],
  },
]

// Quick lookup map — used by the API route to find a schema by module key
export const AI_MODULE_MAP: Record<string, AiModuleSchema> = AI_MODULE_SCHEMAS.reduce(
  (acc, schema) => {
    acc[schema.key] = schema
    return acc
  },
  {} as Record<string, AiModuleSchema>
)

/**
 * Coerce a raw value (from AI JSON response) into the correct type for the
 * given field. Returns undefined if the value can't be coerced — the caller
 * will then leave that field empty in the form.
 */
export function coerceFieldValue(field: AiField, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') return undefined

  switch (field.type) {
    case 'number': {
      if (typeof raw === 'number') return raw
      const n = Number(String(raw).replace(/[₹,\s]/g, ''))
      return isNaN(n) ? undefined : n
    }
    case 'date': {
      const s = String(raw).trim()
      if (!s) return undefined
      // AI returns ISO date (YYYY-MM-DD). Accept that directly.
      // Also handle DD-MM-YYYY / DD/MM/YYYY.
      const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      if (isoMatch) return s
      const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
      if (dmyMatch) {
        const [, dd, mm, yy] = dmyMatch
        const year = yy.length === 2 ? `20${yy}` : yy
        return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      }
      // Try Date.parse as last resort
      const parsed = new Date(s)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10)
      }
      return undefined
    }
    case 'phone': {
      const digits = String(raw).replace(/[^\d+]/g, '')
      // Keep +91 prefix if present, otherwise digits only
      return digits || undefined
    }
    case 'string':
    default:
      return String(raw).trim() || undefined
  }
}

/**
 * Build the system prompt for OpenAI describing the module's fields.
 * The model is instructed to extract values from the user's natural-language
 * input and return them as a JSON object matching the field keys.
 *
 * We use structured outputs (response_format: json_schema) so the model
 * is forced to return valid JSON with the exact field keys.
 */
export function buildSystemPrompt(schema: AiModuleSchema): string {
  const fieldLines = schema.fields
    .map((f) => {
      const aliases = f.aliases.length > 0 ? ` (aliases: ${f.aliases.join(', ')})` : ''
      const unit = f.unit ? `, unit: ${f.unit}` : ''
      const req = f.required ? ', REQUIRED' : ''
      return `  - "${f.key}" (${f.type}${unit}${req}): ${f.label}${aliases}`
    })
    .join('\n')

  return `You are a form-filling assistant for the Veda Enterprises ERP system.

MODULE: ${schema.label}
DESCRIPTION: ${schema.description}

FIELDS TO EXTRACT:
${fieldLines}

RULES:
1. Read the user's natural-language input (Hindi, English, or Hinglish mix) and extract values for each field above.
2. Return ONLY a JSON object with the field keys as property names. Do not include any explanation, markdown, or code fences.
3. For fields the user did not mention, omit the key entirely (do NOT include null or empty string).
4. For "date" fields, return ISO format YYYY-MM-DD. Interpret relative words like "aaj" (today), "kal" (yesterday) using today's date as reference: ${new Date().toISOString().slice(0, 10)}.
5. For "number" fields, return a plain number (no currency symbols, no commas, no units).
6. For "phone" fields, return digits only (optionally with +91 prefix).
7. For "string" fields, return the cleaned-up text. Fix obvious spelling mistakes but preserve the user's intent.
8. If the user mentions multiple product types (e.g., "200 zigzag grey and 100 zigzag red"), put each value in the correct separate field — do NOT concatenate them.
9. If a value is ambiguous (e.g., "200" without context), make your best guess based on the module's primary subject (for production, "200" likely means the most-mentioned product; for payments, it likely means the amount).
10. Do NOT invent values the user did not provide. If unsure, omit the field.

Return JSON now.`
}
