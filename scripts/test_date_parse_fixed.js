// Test the FIXED parseDate function with real Production.xlsx dates
// + edge cases that previously triggered the buggy new Date() fallback

function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(value) {
  if (!value || value.trim() === '') return todayLocal()
  const trimmed = value.trim().replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '').replace(/\s+\d{1,2}:\d{2}.*$/, '').trim()
  if (trimmed === '') return todayLocal()
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const ymdMatch = trimmed.match(/^(\d{4})[/.\s](\d{1,2})[/.\s](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
  if (dmyMatch) {
    let [, a, b, y] = dmyMatch
    let d, m
    if (Number(a) > 12 && Number(b) <= 12) {
      d = a; m = b   // First > 12 → DD-MM (Indian)
    } else if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b   // Second > 12 → MM-DD (US)
    } else {
      d = a; m = b   // Default DD-MM (Indian)
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
  if (dmyShortMatch) {
    let [, a, b, y] = dmyShortMatch
    let d, m
    if (Number(a) > 12 && Number(b) <= 12) {
      d = a; m = b
    } else if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b
    } else {
      d = a; m = b
    }
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return todayLocal()
}

// Test cases: real Production.xlsx dates + edge cases
const tests = [
  // Real dates from Production.xlsx
  ['21-06-2026', '2026-06-21', 'Indian DD-MM-YYYY (June 21)'],
  ['20-06-2026', '2026-06-20', 'Indian DD-MM-YYYY (June 20)'],
  ['17-06-2026', '2026-06-17', 'Indian DD-MM-YYYY (June 17)'],
  ['15-06-2026', '2026-06-15', 'Indian DD-MM-YYYY (June 15)'],
  ['13-06-2026', '2026-06-13', 'Indian DD-MM-YYYY (June 13)'],
  ['31-05-2026', '2026-05-31', 'Indian DD-MM-YYYY (May 31)'],
  ['28-04-2026', '2026-04-28', 'Indian DD-MM-YYYY (Apr 28)'],

  // Dates from user's screenshot (July 2026)
  ['16-07-2026', '2026-07-16', 'Indian DD-MM-YYYY (July 16)'],
  ['14-07-2026', '2026-07-14', 'Indian DD-MM-YYYY (July 14)'],
  ['13-07-2026', '2026-07-13', 'Indian DD-MM-YYYY (July 13)'],

  // Datetime strings (also from xlsx)
  ['2026-06-05 00:00:00', '2026-06-05', 'ISO datetime (June 5)'],
  ['2026-06-04 00:00:00', '2026-06-04', 'ISO datetime (June 4)'],

  // Edge cases — AMBIGUOUS dates
  ['05-06-2026', '2026-06-05', 'AMBIGUOUS: should be June 5 (DD-MM)'],
  ['5-6-2026',   '2026-06-05', 'AMBIGUOUS: should be June 5 (DD-MM)'],
  ['05/06/2026', '2026-06-05', 'AMBIGUOUS: should be June 5 (DD/MM)'],
  ['05.06.2026', '2026-06-05', 'AMBIGUOUS: should be June 5 (DD.MM)'],
  ['12-07-2026', '2026-07-12', 'AMBIGUOUS: should be July 12 (DD-MM)'],

  // US format (only when first > 12)
  ['13-01-2024', '2024-01-13', 'US MM-DD: Jan 13 (first > 12)'],
  ['13/01/2024', '2024-01-13', 'US MM/DD: Jan 13'],

  // ISO format
  ['2026-07-16', '2026-07-16', 'ISO YYYY-MM-DD'],
  ['2026/07/16', '2026-07-16', 'ISO YYYY/MM/DD'],

  // Short year
  ['16-07-26', '2026-07-16', 'Short year DD-MM-YY'],
  ['05-06-26', '2026-06-05', 'Short year AMBIGUOUS'],

  // Edge cases that USED TO trigger buggy new Date() fallback
  ['',         todayLocal(), 'Empty → today'],
  ['  ',       todayLocal(), 'Whitespace → today'],
  ['invalid',  todayLocal(), 'Invalid string → today (no more US-flip!)'],
]

let pass = 0, fail = 0
console.log('--- Testing FIXED parseDate ---')
console.log('Input                | Output          | Expected        | Status')
console.log('---------------------|-----------------|-----------------|-------')
tests.forEach(([input, expected, label]) => {
  const output = parseDate(input)
  const ok = output === expected
  if (ok) pass++; else fail++
  console.log(
    `${input.padEnd(20)} | ${output.padEnd(15)} | ${expected.padEnd(15)} | `
    + (ok ? '✓' : '✗ FAIL')
    + (ok ? '' : `  [${label}]`)
  )
})
console.log()
console.log(`Result: ${pass} passed, ${fail} failed out of ${tests.length}`)
if (fail > 0) process.exit(1)
