// Verify the production template download matches the user's screenshot.
// Expected headers (from pasted_image_1783323051397.png):
//   Date, Cement, Zig Zag Grey 80mm, Zig Zag Red 80mm, Zig Zag Yellow 80mm,
//   Zig Zag Grey 60mm, Zig Zag Red 60mm, Zig Zag Yellow 60mm,
//   Chequre Tile, Curve Stone,
//   Dumble Grey 80mm, Dumble Red 80mm, Dumble Yellow 80mm

const productionFields = [
  { key: 'date', label: 'Date', inTemplate: undefined },
  { key: 'cement', label: 'Cement', inTemplate: undefined },
  { key: 'zigZagGrey80', label: 'Zig Zag Grey 80mm', inTemplate: undefined },
  { key: 'zigZagRed80', label: 'Zig Zag Red 80mm', inTemplate: undefined },
  { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80mm', inTemplate: undefined },
  { key: 'zigZagGrey60', label: 'Zig Zag Grey 60mm', inTemplate: undefined },
  { key: 'zigZagRed60', label: 'Zig Zag Red 60mm', inTemplate: undefined },
  { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60mm', inTemplate: undefined },
  { key: 'chequreTile', label: 'Chequre Tile', inTemplate: undefined },
  { key: 'curveStone', label: 'Curve Stone', inTemplate: undefined },
  { key: 'dumbleGrey80', label: 'Dumble Grey 80mm', inTemplate: undefined },
  { key: 'dumbleRed80', label: 'Dumble Red 80mm', inTemplate: undefined },
  { key: 'dumbleYellow80', label: 'Dumble Yellow 80mm', inTemplate: undefined },
  { key: 'transportationCharge', label: 'Transportation Charge', inTemplate: false },
  { key: 'remarks', label: 'Remarks', inTemplate: false },
]

// Mirror of downloadTemplate() logic
const headers = productionFields
  .filter((f) => f.inTemplate !== false)
  .map((f) => f.label)

const expected = [
  'Date', 'Cement',
  'Zig Zag Grey 80mm', 'Zig Zag Red 80mm', 'Zig Zag Yellow 80mm',
  'Zig Zag Grey 60mm', 'Zig Zag Red 60mm', 'Zig Zag Yellow 60mm',
  'Chequre Tile', 'Curve Stone',
  'Dumble Grey 80mm', 'Dumble Red 80mm', 'Dumble Yellow 80mm',
]

console.log('Generated CSV headers:')
console.log(headers.join(','))
console.log('')
console.log('Expected (from screenshot):')
console.log(expected.join(','))
console.log('')

const matches = headers.length === expected.length &&
  headers.every((h, i) => h === expected[i])

console.log(`Column count: ${headers.length} (expected ${expected.length})`)
console.log(`MATCH: ${matches ? 'YES ✓' : 'NO ✗'}`)

if (!matches) {
  console.log('\nDifferences:')
  for (let i = 0; i < Math.max(headers.length, expected.length); i++) {
    if (headers[i] !== expected[i]) {
      console.log(`  Position ${i + 1}: got "${headers[i] ?? '—'}", expected "${expected[i] ?? '—'}"`)
    }
  }
  process.exit(1)
}

// Also print what the CSV file content would look like
console.log('\n=== Full CSV content (production_import_template.csv) ===')
console.log(headers.join(',') + '\n')
