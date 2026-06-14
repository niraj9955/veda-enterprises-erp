import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/veda-erp';

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => {
      console.log('MongoDB connected');
      return m;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Helper: convert Mongoose doc to plain object with id instead of _id
// Handles populated ObjectId fields by preserving the original _id as string
export function toObject(doc: any): any {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(toObject);
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  if (obj.__v !== undefined) delete obj.__v;
  // Convert any remaining ObjectId instances to strings
  for (const key of Object.keys(obj)) {
    if (obj[key] instanceof mongoose.Types.ObjectId) {
      obj[key] = obj[key].toString();
    }
  }
  return obj;
}

// Helper: extract customer info from a populated document
export function extractCustomer(doc: any) {
  const cust = doc.customerId as any
  if (!cust) return { customer: null, customerId: null }
  // If populated, customerId is a full document
  if (cust.name) {
    return {
      customer: { id: cust._id ? cust._id.toString() : cust.id, name: cust.name },
      customerId: cust._id ? cust._id.toString() : cust.id,
    }
  }
  // If not populated, customerId is just an ObjectId
  return {
    customer: null,
    customerId: cust.toString ? cust.toString() : cust,
  }
}

// Helper: extract order info from a populated document
export function extractOrder(doc: any) {
  const ord = doc.orderId as any
  if (!ord) return { order: null, orderId: null }
  if (ord.orderNumber) {
    return {
      order: { id: ord._id ? ord._id.toString() : ord.id, orderNumber: ord.orderNumber },
      orderId: ord._id ? ord._id.toString() : ord.id,
    }
  }
  return {
    order: null,
    orderId: ord.toString ? ord.toString() : ord,
  }
}
