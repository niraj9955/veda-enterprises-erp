import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'veda-enterprises-erp-secret-key-2024'
)

export interface JWTPayload {
  userId: string
  email: string
  role: string
  name: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

export function hasAccess(role: string, module: string): boolean {
  const accessMap: Record<string, string[]> = {
    admin: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'settings', 'users', 'admin', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff'],
    operator: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff'],
    accountant: ['dashboard', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff'],
  }
  return accessMap[role]?.includes(module) || false
}

// Granular permission check: can user perform a specific action on a module?
export function canPerform(role: string, module: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
  const permissionMap: Record<string, Record<string, string[]>> = {
    admin: {
      dashboard: ['read'],
      customers: ['create', 'read', 'update', 'delete'],
      production: ['create', 'read', 'update', 'delete'],
      stock: ['create', 'read', 'update', 'delete'],
      orders: ['create', 'read', 'update', 'delete'],
      dispatch: ['create', 'read', 'update', 'delete'],
      payments: ['create', 'read', 'update', 'delete'],
      expenses: ['create', 'read', 'update', 'delete'],
      reports: ['read'],
      settings: ['create', 'read', 'update', 'delete'],
      users: ['create', 'read', 'update', 'delete'],
      admin: ['create', 'read', 'update', 'delete'],
      dailySell: ['create', 'read', 'update', 'delete'],
      customerPayment: ['create', 'read', 'update', 'delete'],
      labourPayment: ['create', 'read', 'update', 'delete'],
      tractorPayment: ['create', 'read', 'update', 'delete'],
      dustPurchase: ['create', 'read', 'update', 'delete'],
      cementPurchase: ['create', 'read', 'update', 'delete'],
      hardner: ['create', 'read', 'update', 'delete'],
      electricity: ['create', 'read', 'update', 'delete'],
      factoryStuff: ['create', 'read', 'update', 'delete'],
    },
    operator: {
      dashboard: ['read'],
      customers: ['create', 'read', 'update'],
      production: ['create', 'read', 'update'],
      stock: ['create', 'read'],
      orders: ['create', 'read', 'update'],
      dispatch: ['create', 'read', 'update'],
      payments: ['create', 'read'],
      expenses: ['create', 'read'],
      reports: ['read'],
      dailySell: ['create', 'read', 'update'],
      customerPayment: ['create', 'read', 'update'],
      labourPayment: ['create', 'read', 'update'],
      tractorPayment: ['create', 'read', 'update'],
      dustPurchase: ['create', 'read', 'update'],
      cementPurchase: ['create', 'read', 'update'],
      hardner: ['create', 'read', 'update'],
      electricity: ['create', 'read', 'update'],
      factoryStuff: ['create', 'read', 'update'],
    },
    accountant: {
      dashboard: ['read'],
      payments: ['create', 'read', 'update'],
      expenses: ['create', 'read', 'update'],
      reports: ['read'],
      dailySell: ['create', 'read', 'update'],
      customerPayment: ['create', 'read', 'update'],
      labourPayment: ['create', 'read', 'update'],
      tractorPayment: ['create', 'read', 'update'],
      dustPurchase: ['create', 'read', 'update'],
      cementPurchase: ['create', 'read', 'update'],
      hardner: ['create', 'read', 'update'],
      electricity: ['create', 'read', 'update'],
      factoryStuff: ['create', 'read', 'update'],
    },
  }

  return permissionMap[role]?.[module]?.includes(action) || false
}
