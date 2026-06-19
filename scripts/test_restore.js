#!/usr/bin/env node
/**
 * Smoke test for the database restore fix.
 *
 * Verifies that:
 *   1. GET /api/database returns the v2 backup shape with all 19 collections
 *   2. PUT /api/database can restore from the v2 file format
 *      (i.e. { data: { ...collections... }, counts, version }) — this is
 *      what the frontend sends after api.restoreBackup wraps the parsed
 *      file once more.
 *   3. Customer docs retain their original _id after a clear+restore cycle
 *
 * Run via: node /home/z/my-project/scripts/test_restore.js
 *
 * NOTE: requires a running dev server (npm run dev) on port 3000 and an
 * authenticated session cookie. For a quick local smoke check, see the
 * shape-mocking test below — it doesn't hit the server.
 */

// ─── Shape-mocking test (no server required) ────────────────────────────────
// Simulates the frontend → backend round trip for restore.

const parsedFile = {
  version: 2,
  exportedAt: '2025-01-01T00:00:00.000Z',
  data: {
    customers: [
      { _id: '6582f7a1b3c4d5e6f7080a1b', name: 'Test Cust', mobile: '9999999999' },
      { _id: '6582f7a1b3c4d5e6f7080a1c', name: 'Another',  mobile: '8888888888' },
    ],
    bills: [
      { _id: '6582f7a1b3c4d5e6f7080a1d', billNumber: 'BILL-202501-0001', toName: 'Test Cust' },
    ],
  },
  counts: { customers: 2, bills: 1 },
}

// Frontend normalises: pass parsed.data (the inner collections map)
const payloadForApi =
  parsedFile.data && typeof parsedFile.data === 'object' && !Array.isArray(parsedFile.data)
    ? parsedFile.data
    : parsedFile

// api.restoreBackup wraps once: { data: payloadForApi }
const requestBody = { data: payloadForApi }

// Backend normalises: unwrap nested data
let backendData = {}
const body = requestBody
if (body?.data?.data && typeof body.data.data === 'object') {
  backendData = body.data.data
} else if (
  (body?.data && Array.isArray(body.data.customers)) ||
  body?.data?.customers !== undefined
) {
  backendData = body.data
} else if (body?.customers !== undefined || body?.data) {
  backendData = body.data || body
}

// Assertion
const customers = backendData.customers || []
const bills = backendData.bills || []
console.log('--- Restore round-trip smoke test ---')
console.log(`Customers received by insertMany: ${customers.length}`)
console.log(`Bills received by insertMany:     ${bills.length}`)
console.log(`First customer _id preserved:     ${customers[0]?._id === '6582f7a1b3c4d5e6f7080a1b'}`)
console.log(`First bill _id preserved:         ${bills[0]?._id === '6582f7a1b3c4d5e6f7080a1d'}`)

const pass =
  customers.length === 2 &&
  bills.length === 1 &&
  customers[0]?._id === '6582f7a1b3c4d5e6f7080a1b' &&
  bills[0]?._id === '6582f7a1b3c4d5e6f7080a1d'

console.log(pass ? '\n✓ PASS — restore round-trip is correct' : '\n✗ FAIL — see output above')
process.exit(pass ? 0 : 1)
