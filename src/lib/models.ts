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

// ─── Production (Product-wise with customer & transport) ────────────────────
const ProductionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, default: '' },
  address: { type: String, default: '' },
  zigZagWhite80: { type: Number, default: 0 },
  zigZagRed80: { type: Number, default: 0 },
  zigZagYellow80: { type: Number, default: 0 },
  zigZagWhite60: { type: Number, default: 0 },
  zigZagRed60: { type: Number, default: 0 },
  zigZagYellow60: { type: Number, default: 0 },
  curveStone: { type: Number, default: 0 },
  chequreTile: { type: Number, default: 0 },
  transportationCharge: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });

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

// ─── Daily Sell ────────────────────────────────────────────────────────────
const DailySellSchema = new mongoose.Schema({
  date: { type: String, required: true },
  customerName: { type: String, required: true },
  address: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
  contactNumber: { type: String, default: '' },
}, { timestamps: true });

// ─── Customer Payment ──────────────────────────────────────────────────────
const CustomerPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// ─── Labour Payment ────────────────────────────────────────────────────────
const LabourPaymentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

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

// ─── Hardner ───────────────────────────────────────────────────────────────
const HardnerSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true },
}, { timestamps: true });

// ─── Electricity ───────────────────────────────────────────────────────────
const ElectricitySchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String, default: '' },
  work: { type: String, default: '' },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// ─── Factory Stuff ─────────────────────────────────────────────────────────
const FactoryStuffSchema = new mongoose.Schema({
  date: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// ─── Legacy Models (kept for backward compatibility with existing API routes) ─
const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  brickType: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
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
}, { timestamps: true });

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
