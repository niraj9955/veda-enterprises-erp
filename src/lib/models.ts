import mongoose from 'mongoose';

// ─── Company ────────────────────────────────────────────────────────────────
const CompanySchema = new mongoose.Schema({
  name: { type: String, default: 'My Company' },
  tagline: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  primaryColor: { type: String, default: '#059669' },
  bankName: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  bankIfsc: { type: String, default: '' },
  invoicePrefix: { type: String, default: 'INV' },
  dispatchPrefix: { type: String, default: 'DSP' },
  orderPrefix: { type: String, default: 'ORD' },
  terms: { type: String, default: '' },
  signatureName: { type: String, default: 'Authorized Signatory' },
  setupComplete: { type: Boolean, default: false },
}, { timestamps: true });

// ─── User ───────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'operator' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

// ─── Customer ───────────────────────────────────────────────────────────────
const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  gstNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  creditLimit: { type: Number, default: 0 },
}, { timestamps: true });

// Indexes — speed up the most common queries
// mobile: used for dedup check during import + customer search by mobile
CustomerSchema.index({ mobile: 1 });
// name: used for search by name (case-insensitive regex)
CustomerSchema.index({ name: 1 });
// createdAt: used for default sort (newest first)
CustomerSchema.index({ createdAt: -1 });

// ─── Production (Product-wise with customer & transport) ────────────────────
const ProductionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  cement: { type: Number, default: 0 },
  zigZagGrey80: { type: Number, default: 0 },
  zigZagRed80: { type: Number, default: 0 },
  zigZagYellow80: { type: Number, default: 0 },
  zigZagGrey60: { type: Number, default: 0 },
  zigZagRed60: { type: Number, default: 0 },
  zigZagYellow60: { type: Number, default: 0 },
  curveStone: { type: Number, default: 0 },
  chequreTile: { type: Number, default: 0 },
  dumbleGrey80: { type: Number, default: 0 },
  dumbleRed80: { type: Number, default: 0 },
  dumbleYellow80: { type: Number, default: 0 },
  transportationCharge: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });
ProductionSchema.index({ date: -1 });

// ─── Stock (Product-wise tracking) ─────────────────────────────────────────
const StockSchema = new mongoose.Schema({
  date: { type: String, required: true },
  cement: { type: Number, default: 0 },
  zigZagGrey80: { type: Number, default: 0 },
  zigZagRed80: { type: Number, default: 0 },
  zigZagYellow80: { type: Number, default: 0 },
  zigZagGrey60: { type: Number, default: 0 },
  zigZagRed60: { type: Number, default: 0 },
  zigZagYellow60: { type: Number, default: 0 },
  chequreTile: { type: Number, default: 0 },
  curveStone: { type: Number, default: 0 },
  dumbleGrey80: { type: Number, default: 0 },
  dumbleRed80: { type: Number, default: 0 },
  dumbleYellow80: { type: Number, default: 0 },
}, { timestamps: true });
StockSchema.index({ date: -1 });

// ─── Daily Sell ────────────────────────────────────────────────────────────
const DailySellSchema = new mongoose.Schema({
  date: { type: String, required: true },
  customerName: { type: String, required: true },
  address: { type: String, default: '' },
  contactNumber: { type: String, default: '' },
  product: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });
DailySellSchema.index({ date: -1 });
DailySellSchema.index({ customerName: 1 });

// ─── Customer Payment ──────────────────────────────────────────────────────
const CustomerPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });
CustomerPaymentSchema.index({ date: -1 });
CustomerPaymentSchema.index({ name: 1 });

// ─── Labour Payment ────────────────────────────────────────────────────────
const LabourPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });
LabourPaymentSchema.index({ date: -1 });
LabourPaymentSchema.index({ name: 1 });

// ─── Tractor Payment ───────────────────────────────────────────────────────
const TractorPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  vendorName: { type: String, required: true },
  quantityTon: { type: Number, required: true },
  rate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });
TractorPaymentSchema.index({ date: -1 });
TractorPaymentSchema.index({ vendorName: 1 });

// ─── Dust Purchase ─────────────────────────────────────────────────────────
const DustPurchaseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  vendorName: { type: String, required: true },
  cementName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  transportationCharge: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });
DustPurchaseSchema.index({ date: -1 });
DustPurchaseSchema.index({ vendorName: 1 });

// ─── Cement Purchase ───────────────────────────────────────────────────────
const CementPurchaseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  vendorName: { type: String, required: true },
  itemName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  transportationCharge: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });
CementPurchaseSchema.index({ date: -1 });
CementPurchaseSchema.index({ vendorName: 1 });

// ─── Hardner ───────────────────────────────────────────────────────────────
const HardnerSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true },
}, { timestamps: true });
HardnerSchema.index({ date: -1 });

// ─── Electricity ───────────────────────────────────────────────────────────
const ElectricitySchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, default: '' },
  work: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });
ElectricitySchema.index({ date: -1 });

// ─── Factory Stuff ─────────────────────────────────────────────────────────
const FactoryStuffSchema = new mongoose.Schema({
  date: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });
FactoryStuffSchema.index({ date: -1 });

// ─── Legacy Models (kept for backward compatibility with existing API routes) ─
const OrderItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsn: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'pcs' },
  rate: { type: Number, required: true, default: 0 },
  amount: { type: Number, required: true, default: 0 },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  // Primary brick type — kept for backward compatibility with existing
  // orders + dispatches that reference it. Now optional: when the user
  // fills the items[] section instead, this can be empty.
  brickType: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  // Optional line items — when present, these are the detailed breakdown
  // of the order and the top-level quantity/rate/amount become summary
  // fields (sum of item qty, weighted avg rate, sum of item amounts).
  items: [OrderItemSchema],
  deliveryDate: { type: String, required: true },
  status: { type: String, default: 'Pending' },
}, { timestamps: true });

const DispatchSchema = new mongoose.Schema({
  dispatchNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  truckNumber: { type: String, required: true },
  driverName: { type: String, default: '' },
  quantity: { type: Number, required: true },
  brickType: { type: String, required: true },
  date: { type: String, required: true },
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  paymentType: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  remarks: { type: String, default: '' },
  // If this payment was auto-created from a Bill (paidAmount sync), billId
  // links back to the source Bill so the Bill PUT/DELETE routes can update /
  // delete this Payment atomically. Manual payments created via /api/payments
  // have billId = null.
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
  billNumber: { type: String, default: '' },
}, { timestamps: true });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ billId: 1 });

const ExpenseSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

// ─── Bill / Invoice (Multi-purpose billing system) ──────────────────────────
const BillItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hsn: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'pcs' },
  rate: { type: Number, required: true, default: 0 },
  amount: { type: Number, required: true, default: 0 },
}, { _id: false });

const BillSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  billType: {
    type: String,
    required: true,
    enum: ['sales', 'purchase', 'quotation', 'service', 'other'],
    default: 'sales',
  },
  date: { type: String, required: true },
  dueDate: { type: String, default: '' },

  // Bill From (seller — usually the company)
  fromName: { type: String, default: '' },
  fromAddress: { type: String, default: '' },
  fromGst: { type: String, default: '' },
  fromPhone: { type: String, default: '' },

  // Bill To (customer/party)
  // customerId is OPTIONAL — set when the bill is created from an existing
  // customer record. When set, the bill's paidAmount auto-syncs to a Payment
  // document linked to this customer (see /api/bills routes).
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  toName: { type: String, required: true },
  toAddress: { type: String, default: '' },
  toGst: { type: String, default: '' },
  toPhone: { type: String, default: '' },

  // Items
  items: [BillItemSchema],

  // Money calculations
  subTotal: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  cgstPercent: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstPercent: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstPercent: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  // Payment
  paidAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  paymentMode: { type: String, default: 'Cash' },

  // Other
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
    default: 'draft',
  },
  createdBy: { type: String, default: '' },
}, { timestamps: true });
BillSchema.index({ billNumber: 1 });
BillSchema.index({ date: -1 });
BillSchema.index({ billType: 1, status: 1 });
BillSchema.index({ customerId: 1 });

// ─── AI Config (OpenAI API key storage) ─────────────────────────────────────
// Stores the API key + provider config used by the AI form-fill feature.
// Single document (singleton pattern) — we always read the first doc.
// Supports two providers:
//   • openai (default) — OpenAI's official API
//   • groq — GroqCloud (OpenAI-compatible endpoint at api.groq.com/openai/v1)
//            Free tier: 1,000 req/day on llama-3.3-70b-versatile
const AiConfigSchema = new mongoose.Schema({
  // Which AI provider to use ('openai' | 'groq')
  provider: { type: String, default: 'openai', enum: ['openai', 'groq'] },
  // API key — works for whichever provider is selected
  openaiApiKey: { type: String, default: '' },
  // Whether AI features are enabled (admin can toggle off without deleting the key)
  enabled: { type: Boolean, default: false },
  // Which model to use — defaults to gpt-4o-mini (cheap + fast + good Hindi)
  // For Groq, admin will typically switch this to 'llama-3.3-70b-versatile'
  model: { type: String, default: 'gpt-4o-mini' },
}, { timestamps: true });

// ─── Models ─────────────────────────────────────────────────────────────────
export const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
export const Production = mongoose.models.Production || mongoose.model('Production', ProductionSchema);
export const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const Dispatch = mongoose.models.Dispatch || mongoose.model('Dispatch', DispatchSchema);
export const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
export const Expense = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
export const DailySell = mongoose.models.DailySell || mongoose.model('DailySell', DailySellSchema);
export const CustomerPayment = mongoose.models.CustomerPayment || mongoose.model('CustomerPayment', CustomerPaymentSchema);
export const LabourPayment = mongoose.models.LabourPayment || mongoose.model('LabourPayment', LabourPaymentSchema);
export const TractorPayment = mongoose.models.TractorPayment || mongoose.model('TractorPayment', TractorPaymentSchema);
export const DustPurchase = mongoose.models.DustPurchase || mongoose.model('DustPurchase', DustPurchaseSchema);
export const CementPurchase = mongoose.models.CementPurchase || mongoose.model('CementPurchase', CementPurchaseSchema);
export const Hardner = mongoose.models.Hardner || mongoose.model('Hardner', HardnerSchema);
export const Electricity = mongoose.models.Electricity || mongoose.model('Electricity', ElectricitySchema);
export const FactoryStuff = mongoose.models.FactoryStuff || mongoose.model('FactoryStuff', FactoryStuffSchema);
export const Bill = mongoose.models.Bill || mongoose.model('Bill', BillSchema);
export const AiConfig = mongoose.models.AiConfig || mongoose.model('AiConfig', AiConfigSchema);
