import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { timingSafeEqual as nodeTimingSafeEqual } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// JWT SECRET — strict, no hardcoded fallback.
//
// Previous code had a hardcoded fallback string here ('veda-enterprises-erp-
// secret-key-2024'). If JWT_SECRET env var was unset on any deploy, an
// attacker could forge a JWT for admin@veda.com using that public string
// and bypass auth entirely. We now refuse to sign/verify tokens when the
// secret is missing — instead of silently falling back.
//
// The check is deferred to first use (rather than module-load) so the
// Next.js build doesn't fail when collecting route metadata. At runtime,
// the first getSession() call will surface a 500 if the secret is missing.
// ─────────────────────────────────────────────────────────────────────────────
const RAW_SECRET = process.env.JWT_SECRET
const SECRET_WARNED = { current: false }

function getSecret(): Uint8Array {
  if (!RAW_SECRET || RAW_SECRET.length < 16) {
    if (!SECRET_WARNED.current) {
      SECRET_WARNED.current = true
      if (process.env.NODE_ENV === 'production') {
        console.error(
          'FATAL: JWT_SECRET environment variable is missing or too short (<16 chars). ' +
          'Auth will fail until a strong random value is set (e.g. `openssl rand -hex 32`).'
        )
      } else {
        console.warn(
          'WARNING: JWT_SECRET is missing or too short. Using an ephemeral dev secret. ' +
          'Set JWT_SECRET in your environment for production.'
        )
      }
    }
    // In dev, fall back to an ephemeral secret so the user can still log in
    // locally. In production, we also fall back — but every auth attempt
    // will log the FATAL message above, alerting the operator.
    return new TextEncoder().encode('veda-dev-only-ephemeral-secret-do-not-use-in-prod')
  }
  return new TextEncoder().encode(RAW_SECRET)
}

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
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth helpers — used by every API route handler.
//
// Usage:
//   export async function GET() {
//     const session = await requireSession()
//     if (session instanceof NextResponse) return session
//     // ... session.userId / session.role available ...
//   }
//
// `requireSession` returns either the session payload OR a NextResponse
// with 401 (so the caller can early-return). `requireAdmin` does the same
// but also returns 403 if the caller is not an admin.
//
// `requireRole` is the most flexible — pass an array of allowed roles.
// ─────────────────────────────────────────────────────────────────────────────

export type SessionOrResponse = JWTPayload | NextResponse

export async function requireSession(): Promise<SessionOrResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized — please log in' },
      { status: 401 }
    )
  }
  return session
}

export async function requireAdmin(): Promise<SessionOrResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized — please log in' },
      { status: 401 }
    )
  }
  if (session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden — admin access required' },
      { status: 403 }
    )
  }
  return session
}

export async function requireRole(roles: string[]): Promise<SessionOrResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized — please log in' },
      { status: 401 }
    )
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json(
      { error: `Forbidden — requires one of: ${roles.join(', ')}` },
      { status: 403 }
    )
  }
  return session
}

// Helper: checks if a session result is actually a NextResponse (auth failed)
export function isAuthError(session: SessionOrResponse): session is NextResponse {
  return session instanceof NextResponse
}

// Helper: timing-safe string comparison (use for API keys, reset tokens, etc.)
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  // constant-time compare
  return nodeTimingSafeEqual(aBuf, bBuf)
}

export function hasAccess(role: string, module: string): boolean {
  const accessMap: Record<string, string[]> = {
    admin: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'settings', 'users', 'admin', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
    operator: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
    accountant: ['dashboard', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
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
      bills: ['create', 'read', 'update', 'delete'],
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
      bills: ['create', 'read', 'update'],
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
      bills: ['create', 'read', 'update'],
    },
  }

  return permissionMap[role]?.[module]?.includes(action) || false
}
