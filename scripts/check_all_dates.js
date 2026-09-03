const XLSX = require('xlsx');

const filePath = '/home/z/my-project/upload/Production.xlsx';
const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

console.log('=== ALL rows with date column analysis ===');
rows.forEach((r, i) => {
  const cell = r[0];
  let info = '';
  if (cell instanceof Date) {
    info = `Date obj → LOCAL y=${cell.getFullYear()}-${String(cell.getMonth()+1).padStart(2,'0')}-${String(cell.getDate()).padStart(2,'0')} | UTC iso=${cell.toISOString()}`;
  } else if (typeof cell === 'number') {
    info = `number ${cell}`;
  } else if (typeof cell === 'string') {
    info = `string "${cell}"`;
  } else {
    info = `${typeof cell}: ${JSON.stringify(cell)}`;
  }
  console.log(`Row ${i}: ${info}`);
});
