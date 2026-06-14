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
    admin: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports'],
    operator: ['production', 'dispatch', 'stock'],
    accountant: ['payments', 'expenses', 'reports'],
  }
  return accessMap[role]?.includes(module) || false
}
