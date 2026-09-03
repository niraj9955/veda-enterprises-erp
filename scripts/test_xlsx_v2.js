// Debug: trace exactly what xlsx returns for each row's Date column
const XLSX = require('xlsx')
const fs = require('fs')

const arrayBuffer = fs.readFileSync('/home/z/my-project/upload/Production.xlsx')
const workbook = XLSX.read(arrayBuffer, { cellDates: false })
const sheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]

console.log('Sheet name:', sheetName)
console.log('Ref range:', worksheet['!ref'])

// Dump raw cells A1..A20 to see types
console.log('\n--- Raw cells (column A) ---')
for (let r = 1; r <= 20; r++) {
  const addr = `A${r}`
  const cell = worksheet[addr]
  if (cell) {
    console.log(`  ${addr}: type=${cell.t} v=${JSON.stringify(cell.v)} w=${JSON.stringify(cell.w)} z=${JSON.stringify(cell.z)}`)
  } else {
    console.log(`  ${addr}: <empty>`)
  }
}

// Now do sheet_to_json with defval
console.log('\n--- sheet_to_json with defval ---')
const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
console.log('Total rows:', jsonData.length)
console.log('First row keys:', Object.keys(jsonData[0] || {}))

console.log('\n--- First 12 rows, Date column ---')
jsonData.slice(0, 12).forEach((row, i) => {
  // Find the date column — might be named 'Date', 'date', 'DATE', or 'दिनांक'
  const keys = Object.keys(row)
  const dateKey = keys.find(k => /date|दिनांक|tarikh/i.test(k)) || keys[0]
  const v = row[dateKey]
  console.log(`  Row ${i + 2}: key=${JSON.stringify(dateKey)} value=${JSON.stringify(v)} typeof=${typeof v}`)
})

// Also test with header:1 (array-of-arrays)
console.log('\n--- sheet_to_json with header:1 (array-of-arrays) ---')
const arrData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
arrData.slice(0, 12).forEach((row, i) => {
  console.log(`  Row ${i}: ${JSON.stringify(row).slice(0, 200)}`)
})
