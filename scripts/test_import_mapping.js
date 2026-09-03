// Simulate the exact excel-import.tsx logic to verify our fix produces correct
// column mapping + transformed rows for Production.xlsx.
//
// Replicates: normalize(), autoMapColumns(), transformRow(), parseDate()
// from src/components/erp/excel-import.tsx

const XLSX = require('xlsx')
const fs = require('fs')

// ── normalize ──────────────────────────────────────────────────────────────
function normalize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '')
}

// ── autoMapColumns ─────────────────────────────────────────────────────────
function autoMapColumns(excelColumns, moduleFields) {
  const mapping = {} // excelColumn -> fieldKey
  const normalizedExcel = excelColumns.map((col) => ({ original: col, normalized: normalize(col) }))

  for (const field of moduleFields) {
    let bestMatch = ''
    let bestScore = 0

    for (const excelCol of normalizedExcel) {
      if (excelCol.normalized === normalize(field.key)) {
        bestMatch = excelCol.original
        bestScore = 100
        break
      }
      for (const alias of field.aliases) {
        const normAlias = normalize(alias)
        if (excelCol.normalized === normAlias) {
          if (100 > bestScore) {
            bestMatch = excelCol.original
            bestScore = 100
          }
          break
        }
      }
      if (bestScore >= 100) break

      for (const alias of field.aliases) {
        const normAlias = normalize(alias)
        if (normAlias.length > 2 && (excelCol.normalized.includes(normAlias) || normAlias.includes(excelCol.normalized))) {
          const score = Math.min(normAlias.length, excelCol.normalized.length) / Math.max(normAlias.length, excelCol.normalized.length) * 80
          if (score > bestScore) {
            bestMatch = excelCol.original
            bestScore = score
          }
        }
      }
    }

    if (bestMatch && bestScore >= 50) {
      mapping[bestMatch] = field.key
    }
  }

  return mapping
}

// ── parseDate ──────────────────────────────────────────────────────────────
function parseDate(value) {
  if (!value || value.trim() === '') return new Date().toISOString().split('T')[0]
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
  if (dmyShortMatch) {
    const [, d, m, y] = dmyShortMatch
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const mdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    if (Number(m) > 12) return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0]
  } catch {}
  return trimmed
}

// ── transformRow ───────────────────────────────────────────────────────────
const NUMERIC_FIELDS = [
  'quantityProduced', 'quantity', 'creditLimit', 'amount', 'rate',
  'zigZagGrey80', 'zigZagRed80', 'zigZagYellow80',
  'zigZagGrey60', 'zigZagRed60', 'zigZagYellow60',
  'curveStone', 'chequreTile', 'transportationCharge',
  'cement', 'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80',
  'quantityTon', 'totalAmount', 'paidAmount', 'remainingAmount',
  'gst',
]

function transformRow(row, mapping) {
  const result = {}
  for (const [excelCol, fieldKey] of Object.entries(mapping)) {
    let value = row[excelCol]

    if (NUMERIC_FIELDS.includes(fieldKey)) {
      const numVal = Number(String(value || '').replace(/[^0-9.-]/g, '') || 0)
      result[fieldKey] = isNaN(numVal) ? 0 : numVal
      continue
    }

    if (['date', 'deliveryDate'].includes(fieldKey)) {
      // Excel serial date handling (NEW)
      if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = Math.round((value - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) {
          result[fieldKey] = d.toISOString().split('T')[0]
          continue
        }
      }
      if (value instanceof Date && !isNaN(value.getTime())) {
        result[fieldKey] = value.toISOString().split('T')[0]
        continue
      }
      result[fieldKey] = parseDate(String(value || ''))
      continue
    }

    result[fieldKey] = String(value || '')
  }
  return result
}

// ── production template (matches excel-import.tsx) ─────────────────────────
const productionFields = [
  { key: 'date', label: 'Date', aliases: ['date', 'production date', 'production_date', 'date of production', 'दिनांक', 'tarikh'] },
  { key: 'cement', label: 'Cement', aliases: ['cement', 'cement bags', 'cementbags', 'सीमेंट'] },
  { key: 'zigZagGrey80', label: 'Zig Zag Grey 80', aliases: ['zigzaggrey80', 'zig zag grey 80', 'zig_zag_grey_80', 'zz grey 80', 'grey 80', 'zigzagwhite80', 'zig zag white 80', 'zz white 80', 'white 80', 'zigzaggrey80mm', 'zig zag grey 80mm', 'zigzagwhite80mm', 'zig zag white 80mm'] },
  { key: 'zigZagRed80', label: 'Zig Zag Red 80', aliases: ['zigzagred80', 'zig zag red 80', 'zig_zag_red_80', 'zz red 80', 'red 80', 'zigzagred80mm', 'zig zag red 80mm'] },
  { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80', aliases: ['zigzagyellow80', 'zig zag yellow 80', 'zig_zag_yellow_80', 'zz yellow 80', 'yellow 80', 'zigzagyellow80mm', 'zig zag yellow 80mm'] },
  { key: 'zigZagGrey60', label: 'Zig Zag Grey 60', aliases: ['zigzaggrey60', 'zig zag grey 60', 'zig_zag_grey_60', 'zz grey 60', 'grey 60', 'zigzagwhite60', 'zig zag white 60', 'zz white 60', 'white 60', 'zigzaggrey60mm', 'zig zag grey 60mm', 'zigzagwhite60mm', 'zig zag white 60mm'] },
  { key: 'zigZagRed60', label: 'Zig Zag Red 60', aliases: ['zigzagred60', 'zig zag red 60', 'zig_zag_red_60', 'zz red 60', 'red 60', 'zigzagred60mm', 'zig zag red 60mm'] },
  { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60', aliases: ['zigzagyellow60', 'zig zag yellow 60', 'zig_zag_yellow_60', 'zz yellow 60', 'yellow 60', 'zigzagyellow60mm', 'zig zag yellow 60mm'] },
  { key: 'curveStone', label: 'Curve Stone', aliases: ['curvestone', 'curve stone', 'curve_stone', 'curve'] },
  { key: 'chequreTile', label: 'Chequre Tile', aliases: ['chequretile', 'chequre tile', 'chequre_tile', 'chequre', 'tile'] },
  { key: 'dumbleGrey80', label: 'Dumble Grey 80', aliases: ['dumblegrey80', 'dumble grey 80', 'dumble_grey_80', 'dumble grey 80mm'] },
  { key: 'dumbleRed80', label: 'Dumble Red 80', aliases: ['dumblered80', 'dumble red 80', 'dumble_red_80', 'dumble red 80mm'] },
  { key: 'dumbleYellow80', label: 'Dumble Yellow 80', aliases: ['dumbleyellow80', 'dumble yellow 80', 'dumble_yellow_80', 'dumble yellow 80mm'] },
  { key: 'transportationCharge', label: 'Transportation Charge', aliases: ['transportationcharge', 'transportation charge', 'transportation_charge', 'transport', 'transport charge'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'remark', 'note', 'notes', 'comment', 'comments', 'टिप्पणी'] },
]

// ── run simulation ─────────────────────────────────────────────────────────
const buf = fs.readFileSync('/home/z/my-project/upload/Production.xlsx')
const wb = XLSX.read(buf)
const ws = wb.Sheets[wb.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' })

console.log('Excel columns:', Object.keys(jsonData[0]))
console.log('Total rows:', jsonData.length)

const mapping = autoMapColumns(Object.keys(jsonData[0]), productionFields)
console.log('\n=== Auto-mapping result ===')
console.log(JSON.stringify(mapping, null, 2))

console.log('\n=== Sample transformed rows (first 5) ===')
for (let i = 0; i < 5; i++) {
  const transformed = transformRow(jsonData[i], mapping)
  console.log(`Row ${i + 2}:`, JSON.stringify(transformed))
}

console.log('\n=== Last 3 transformed rows (date serial number test) ===')
for (let i = jsonData.length - 3; i < jsonData.length; i++) {
  const transformed = transformRow(jsonData[i], mapping)
  console.log(`Row ${i + 2}:`, JSON.stringify(transformed))
}

// Verify nothing is unexpectedly 0 or missing
console.log('\n=== Validation summary ===')
let total = jsonData.length
let grey80Filled = 0
let grey60Filled = 0
let dumbleFilled = 0
let dateValid = 0
let cementFilled = 0

for (const row of jsonData) {
  const t = transformRow(row, mapping)
  if (Number(t.zigZagGrey80) > 0) grey80Filled++
  if (Number(t.zigZagGrey60) > 0) grey60Filled++
  if (Number(t.dumbleGrey80) > 0 || Number(t.dumbleRed80) > 0 || Number(t.dumbleYellow80) > 0) dumbleFilled++
  if (Number(t.cement) > 0) cementFilled++
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(t.date))) dateValid++
}

console.log(`Total rows:        ${total}`)
console.log`Rows with cement:  ${cementFilled}`
console.log(`Rows with ZZ Grey 80: ${grey80Filled}`)
console.log(`Rows with ZZ Grey 60: ${grey60Filled}`)
console.log(`Rows with any Dumble: ${dumbleFilled}`)
console.log(`Rows with valid YYYY-MM-DD date: ${dateValid}`)
