// Final verification: run normalizeDate() against every date format
// we claim to support, and verify it returns the correct YYYY-MM-DD.
//
// Run: node /home/z/my-project/scripts/test_normalize_date.cjs

// Inline copy of normalizeDate() so this script runs standalone
function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeDate(value) {
  if (value == null) return ''
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 59 && value < 60000) {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return ''
    if (/^\d{4,6}(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      if (Number.isFinite(num) && num > 59 && num < 60000) {
        const ms = Math.round((num - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
      }
    }
    const dateOnly = trimmed
      .replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '')
      .replace(/\s+\d{1,2}:\d{2}.*$/, '')
      .trim()
    if (dateOnly === '') return todayLocal()
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateOnly)) {
      const [y, m, d] = dateOnly.split('-')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const ymdMatch = dateOnly.match(/^(\d{4})[/.\s](\d{1,2})[/.\s](\d{1,2})$/)
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const dmyMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
    if (dmyMatch) {
      const [, a, b, y] = dmyMatch
      let d, m
      if (Number(a) > 12 && Number(b) <= 12) { d = a; m = b }
      else if (Number(b) > 12 && Number(a) <= 12) { m = a; d = b }
      else { d = a; m = b }
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const dmyShortMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
    if (dmyShortMatch) {
      const [, a, b, y] = dmyShortMatch
      let d, m
      if (Number(a) > 12 && Number(b) <= 12) { d = a; m = b }
      else if (Number(b) > 12 && Number(a) <= 12) { m = a; d = b }
      else { d = a; m = b }
      return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return todayLocal()
  }
  return todayLocal()
}

// ─── Test cases ───────────────────────────────────────────────────────────
const tests = [
  // [input, expected_output, description]
  // ─── Indian default (DD-MM-YYYY with various separators) ────────────────
  ['21-06-2026', '2026-06-21', 'DD-MM-YYYY (Indian default, dash)'],
  ['21/06/2026', '2026-06-21', 'DD/MM/YYYY (Indian default, slash)'],
  ['21.06.2026', '2026-06-21', 'DD.MM.YYYY (Indian default, dot)'],
  ['21 06 2026', '2026-06-21', 'DD MM YYYY (Indian default, space)'],

  // ─── Days 13-31 force DD-MM interpretation (first number > 12) ──────────
  ['13-07-2026', '2026-07-13', '13-07-2026 → 13 July (first > 12 forces day)'],
  ['16-07-2026', '2026-07-16', '16-07-2026 → 16 July'],
  ['14-07-2026', '2026-07-14', '14-07-2026 → 14 July'],
  ['31-12-2026', '2026-12-31', '31-12-2026 → 31 December'],

  // ─── Ambiguous (both ≤ 12) → default to DD-MM (Indian) ─────────────────
  ['05-06-2026', '2026-06-05', '05-06-2026 → 5 June (ambiguous → Indian default)'],
  ['05/06/2026', '2026-06-05', '05/06/2026 → 5 June'],
  ['07-07-2026', '2026-07-07', '07-07-2026 → 7 July (same either way)'],
  ['09-07-2026', '2026-07-09', '09-07-2026 → 9 July'],
  ['10-07-2026', '2026-07-10', '10-07-2026 → 10 July'],
  ['11-07-2026', '2026-07-11', '11-07-2026 → 11 July'],
  ['12-07-2026', '2026-07-12', '12-07-2026 → 12 July'],

  // ─── US format (MM-DD-YYYY) — only when first ≤ 12 AND second > 12 ─────
  ['07-13-2026', '2026-07-13', '07-13-2026 → 13 July (US format — second > 12)'],
  ['07/14/2026', '2026-07-14', '07/14/2026 → 14 July'],
  ['12/31/2026', '2026-12-31', '12/31/2026 → 31 December'],

  // ─── ISO format (YYYY-MM-DD) ───────────────────────────────────────────
  ['2026-06-21', '2026-06-21', 'ISO YYYY-MM-DD (canonical)'],
  ['2026/06/21', '2026-06-21', 'YYYY/MM/DD'],
  ['2026.06.21', '2026-06-21', 'YYYY.MM.DD'],
  ['2026-6-5', '2026-06-05', 'ISO with single digits (zero-pads)'],

  // ─── Short year (DD-MM-YY → 20XX) ──────────────────────────────────────
  ['21-06-26', '2026-06-21', 'DD-MM-YY (short year)'],
  ['21/06/26', '2026-06-21', 'DD/MM/YY (short year)'],
  ['05-06-26', '2026-06-05', '05-06-26 → 5 June 2026 (ambiguous, Indian)'],

  // ─── Excel serial numbers ──────────────────────────────────────────────
  [46178, '2026-06-05', 'Excel serial 46178 → 5 June 2026'],
  [46177, '2026-06-04', 'Excel serial 46177 → 4 June 2026'],
  [46176, '2026-06-03', 'Excel serial 46176 → 3 June 2026'],
  ['46178', '2026-06-05', 'Numeric string "46178" → 5 June 2026'],

  // ─── Date objects (e.g. from XLSX cellDates:true) ──────────────────────
  // new Date(2026, 5, 21) = June 21, 2026 local (month is 0-indexed)
  [new Date(2026, 5, 21), '2026-06-21', 'Date object (LOCAL getters, no UTC shift)'],

  // ─── Datetime strings (time portion stripped) ──────────────────────────
  ['2026-06-21 10:30:00', '2026-06-21', 'ISO datetime (time stripped)'],
  ['2026-06-21T10:30:00', '2026-06-21', 'ISO datetime T-separator'],
  ['21-06-2026 10:30', '2026-06-21', 'DD-MM-YYYY datetime (time stripped)'],

  // ─── Edge cases ────────────────────────────────────────────────────────
  ['', '', 'Empty string → empty'],
  [null, '', 'null → empty'],
  [undefined, '', 'undefined → empty'],
  ['  21-06-2026  ', '2026-06-21', 'Whitespace trimmed'],

  // ─── The user's actual Excel file dates ────────────────────────────────
  ['16-07-2026', '2026-07-16', 'USER\'S EXCEL: 16-07-2026 → 16 July 2026'],
  ['14-07-2026', '2026-07-14', 'USER\'S EXCEL: 14-07-2026 → 14 July 2026'],
  ['13-07-2026', '2026-07-13', 'USER\'S EXCEL: 13-07-2026 → 13 July 2026'],
  ['05-07-2026', '2026-07-05', 'USER\'S EXCEL: 05-07-2026 → 5 July 2026'],
]

let passed = 0
let failed = 0
console.log('\n┌─ normalizeDate() test suite ─┐')
console.log('└──────────────────────────────┘')
for (const [input, expected, desc] of tests) {
  const actual = normalizeDate(input)
  const ok = actual === expected
  if (ok) {
    passed++
    console.log(`  ✓ [${desc}] input=${JSON.stringify(input)} → ${actual}`)
  } else {
    failed++
    console.log(`  ✗ [${desc}]`)
    console.log(`      input:    ${JSON.stringify(input)}`)
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      actual:   ${JSON.stringify(actual)}`)
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`)
if (failed > 0) {
  process.exit(1)
}
