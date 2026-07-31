const XLSX = require('xlsx');

const filePath = '/home/z/my-project/upload/Production.xlsx';

// Read WITHOUT cellDates to see raw stored values
console.log('=== Reading WITHOUT cellDates (raw) ===');
const wb1 = XLSX.readFile(filePath, { cellDates: false });
const ws1 = wb1.Sheets['Sheet1'];
const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1, raw: true, defval: null });
rows1.slice(0, 15).forEach((r, i) => {
  console.log(`Row ${i}: A=${JSON.stringify(r[0])} (typeof=${typeof r[0]})`);
});

// Inspect cell metadata directly
console.log('\n=== Cell metadata for A8-A12 ===');
for (let r = 8; r <= 12; r++) {
  const addr = `A${r}`;
  const cell = ws1[addr];
  if (cell) {
    console.log(`${addr}: type=${cell.t} | v=${JSON.stringify(cell.v)} | w=${JSON.stringify(cell.w)} | z=${JSON.stringify(cell.z)}`);
  }
}

// Try with cellDates:true for same cells
console.log('\n=== Cell metadata with cellDates:true ===');
const wb2 = XLSX.readFile(filePath, { cellDates: true });
const ws2 = wb2.Sheets['Sheet1'];
for (let r = 8; r <= 12; r++) {
  const addr = `A${r}`;
  const cell = ws2[addr];
  if (cell) {
    console.log(`${addr}: type=${cell.t} | v=${JSON.stringify(cell.v)} | w=${JSON.stringify(cell.w)} | z=${JSON.stringify(cell.z)}`);
  }
}
