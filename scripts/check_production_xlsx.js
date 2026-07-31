const XLSX = require('xlsx');
const path = require('path');

const filePath = '/home/z/my-project/upload/Production.xlsx';
const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });

console.log('=== Sheet Names ===');
console.log(wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  console.log(`Total rows: ${rows.length}`);
  console.log('First 8 rows (raw values):');
  rows.slice(0, 8).forEach((r, i) => {
    const firstCell = r[0];
    let cellInfo = '';
    if (firstCell instanceof Date) {
      cellInfo = `[Date object] y=${firstCell.getFullYear()} m=${firstCell.getMonth()+1} d=${firstCell.getDate()} iso=${firstCell.toISOString()}`;
    } else if (typeof firstCell === 'number') {
      cellInfo = `[number] ${firstCell}`;
    } else {
      cellInfo = `[${typeof firstCell}] ${JSON.stringify(firstCell)}`;
    }
    console.log(`  Row ${i}: A=${cellInfo} | B=${JSON.stringify(r[1])} | C=${JSON.stringify(r[2])}`);
  });
}
