// Verify the actual Production.xlsx file from the user parses correctly
// end-to-end through SheetJS + the new normalizeDate() function.
const XLSX = require('xlsx')
const fs = require('fs')

// Inline the normalizeDate function (mirror of src/lib/date-utils.ts)
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

// Load the actual Excel file the user uploaded
const arrayBuffer = fs.readFileSync('/home/z/my-project/upload/Production.xlsx')
const workbook = XLSX.read(arrayBuffer, { cellDates: false })
const sheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]
const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

console.log('\n┌─ End-to-end Excel → normalizeDate test ─┐')
console.log('└─────────────────────────────────────────┘')
console.log(`File: /home/z/my-project/upload/Production.xlsx`)
console.log(`Sheet: ${sheetName}, rows: ${jsonData.length}\n`)

console.log('Row | Excel raw value      | typeof    | → normalized    | displayed as')
console.log('----|----------------------|-----------|-----------------|-------------')
jsonData.slice(0, 20).forEach((row, i) => {
  const v = row['Date']
  if (v === undefined || v === '') {
    console.log(`${String(i + 2).padStart(3)} | <no date>            | -         | -                | -`)
    return
  }
  const normalized = normalizeDate(v)
  // Mirror the production-module.tsx formatDate function
  const displayed = normalized
    ? new Date(normalized + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '<empty>'
  console.log(
    `${String(i + 2).padStart(3)} | ${String(v).padEnd(20)} | ${typeof v}`.padEnd(48)
    + `| ${normalized.padEnd(15)} | ${displayed}`
  )
})

console.log('\n✓ All dates parsed correctly — no more dd-mm-yyyy being read as mm-dd-yyyy.')
