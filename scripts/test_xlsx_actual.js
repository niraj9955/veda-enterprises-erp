// Simulate what xlsx library returns when reading Production.xlsx
// and trace through transformRow to find the actual bug

const XLSX = require('xlsx')

async function test() {
  const fs = require('fs')
  const arrayBuffer = fs.readFileSync('/home/z/my-project/upload/Production.xlsx').buffer
  const workbook = XLSX.read(arrayBuffer)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  console.log('--- First 12 rows as returned by xlsx ---')
  console.log('Row | Date column value           | typeof    | Number check')
  console.log('----|------------------------------|-----------|------------')
  jsonData.slice(0, 12).forEach((row, i) => {
    const v = row['Date']
    const numCheck = typeof v === 'string' && /^\d{4,6}(\.\d+)?$/.test(v.trim())
      ? Number(v)
      : NaN
    console.log(
      `${String(i + 2).padStart(3)} | ${String(v).padEnd(28)} | ${typeof v} | `
      + `numeric=${numCheck}, isFinite=${Number.isFinite(numCheck)}, `
      + `>59 && <60000=${numCheck > 59 && numCheck < 60000}`
    )
  })

  console.log()
  console.log('--- Column keys returned by xlsx ---')
  console.log(Object.keys(jsonData[0]))

  console.log()
  console.log('--- First row contents ---')
  console.log(JSON.stringify(jsonData[0], null, 2))

  console.log()
  console.log('--- Now trace through transformRow date handler ---')
  // Replicate the date handling from excel-import.tsx lines 367-394
  function handleDate(value) {
    const numericValue = typeof value === 'number'
      ? value
      : (typeof value === 'string' && /^\d{4,6}(\.\d+)?$/.test(value.trim())
          ? Number(value)
          : NaN)

    if (Number.isFinite(numericValue) && numericValue > 59 && numericValue < 60000) {
      const ms = Math.round((numericValue - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) {
        return { result: d.toISOString().split('T')[0], source: 'Excel serial' }
      }
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return { result: value.toISOString().split('T')[0], source: 'Date object (UTC bug!)' }
    }
    // String path - call parseDate
    return { result: parseDate(String(value || '')), source: 'parseDate()' }
  }

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
    try {
      const date = new Date(trimmed)
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0]
    } catch {}
    return trimmed
  }

  jsonData.slice(0, 12).forEach((row, i) => {
    const v = row['Date'] || row['date'] || row['DATE']
    const out = v === undefined
      ? { result: 'NO_DATE_COLUMN', source: 'column-missing' }
      : handleDate(v)
    console.log(`Row ${i + 2}: input=${JSON.stringify(v).padEnd(28)} → output=${String(out.result).padEnd(12)} via ${out.source}`)
  })
}

test().catch(e => { console.error(e); process.exit(1) })
