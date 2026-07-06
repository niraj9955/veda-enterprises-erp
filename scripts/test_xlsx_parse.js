const XLSX = require('xlsx')
const fs = require('fs')

const buf = fs.readFileSync('/home/z/my-project/upload/Production.xlsx')
const wb = XLSX.read(buf)
const ws = wb.Sheets[wb.SheetNames[0]]
const json = XLSX.utils.sheet_to_json(ws, { defval: '' })

console.log('Sheet name:', wb.SheetNames[0])
console.log('Number of rows:', json.length)
console.log('\nFirst 3 rows (raw):')
console.log(JSON.stringify(json.slice(0, 3), null, 2))

console.log('\nDate column values (first 10 rows):')
for (let i = 0; i < Math.min(10, json.length); i++) {
  console.log(`  Row ${i+2}: Date =`, JSON.stringify(json[i]['Date']), 'type:', typeof json[i]['Date'])
}

console.log('\nAll column headers (row 1):')
console.log(Object.keys(json[0]))
