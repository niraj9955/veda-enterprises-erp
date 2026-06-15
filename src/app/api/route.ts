import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Veda Enterprises ERP API is running' })
}
