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

// ─── Production ─────────────────────────────────────────────────────────────
const ProductionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  brickType: { type: String, required: true },
  quantityProduced: { type: Number, required: true },
  shift: { type: String, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// ─── Stock ──────────────────────────────────────────────────────────────────
const StockSchema = new mongoose.Schema({
  brickType: { type: String, required: true, unique: true },
  openingStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
}, { timestamps: true });

// ─── Order ──────────────────────────────────────────────────────────────────
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

// ─── Dispatch ───────────────────────────────────────────────────────────────
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

// ─── Payment ────────────────────────────────────────────────────────────────
const PaymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  paymentType: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// ─── Expense ────────────────────────────────────────────────────────────────
const ExpenseSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  description: { type: String, default: '' },
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
