// Test the parseDate function from excel-import.tsx with real Production.xlsx data
// Replicates the exact logic to verify date parsing

function parseDate(value) {
  if (!value || value.trim() === '') return new Date().toISOString().split('T')[0]

  const trimmed = value.trim().replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '').replace(/\s+\d{1,2}:\d{2}.*$/, '').trim()
  if (trimmed === '') return new Date().toISOString().split('T')[0]

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
    if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b
    } else {
      d = a; m = b
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
  if (dmyShortMatch) {
    let [, a, b, y] = dmyShortMatch
    let d, m
    if (Number(b) > 12 && Number(a) <= 12) {
      m = a; d = b
    } else {
      d = a; m = b
    }
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {}
  return trimmed
}

// Test with actual dates from Production.xlsx
const testDates = [
  '21-06-2026',  // → expected: 2026-06-21 (21 June 2026)
  '20-06-2026',  // → expected: 2026-06-20 (20 June 2026)
  '17-06-2026',  // → expected: 2026-06-17 (17 June 2026)
  '15-06-2026',  // → expected: 2026-06-15 (15 June 2026)
  '13-06-2026',  // → expected: 2026-06-13 (13 June 2026)
  '05-06-2026',  // → AMBIGUOUS: user says DD-MM = 5 June 2026
  '05/06/2026',  // → AMBIGUOUS: user says DD/MM = 5 June 2026
  '5-6-2026',    // → AMBIGUOUS: user says DD-MM = 5 June 2026
  '12-07-2026',  // → expected: 2026-07-12 (12 July 2026)
  '07-12-2026',  // → AMBIGUOUS: user says DD-MM = 7 Dec 2026; MM-DD = July 12
]

console.log('--- Testing parseDate with DD-MM-YYYY inputs ---')
console.log('Input          | Parsed Output   | Expected (DD-MM) | Match?')
console.log('---------------|-----------------|------------------|-------')
testDates.forEach(input => {
  const output = parseDate(input)
  // Calculate what the expected DD-MM interpretation would be:
  const m = input.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
  let expected = 'N/A'
  if (m) {
    const [, d, mon, y] = m
    expected = `${y}-${mon.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const match = output === expected ? '✓' : '✗ MISMATCH!'
  console.log(`${input.padEnd(14)} | ${output.padEnd(15)} | ${expected.padEnd(16)} | ${match}`)
})

console.log()
console.log('--- Testing native new Date() fallback for DD-MM-YYYY ---')
const ambiguous = ['05-06-2026', '12-07-2026', '07-12-2026']
ambiguous.forEach(s => {
  const d = new Date(s)
  console.log(`new Date("${s}"): ${isNaN(d) ? 'Invalid' : d.toISOString()}  →  toISOString().split('T')[0] = ${isNaN(d) ? 'N/A' : d.toISOString().split('T')[0]}`)
})
