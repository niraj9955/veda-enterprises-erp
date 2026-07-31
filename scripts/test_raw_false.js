const XLSX = require('xlsx');

const filePath = '/home/z/my-project/upload/Production.xlsx';

console.log('=== TEST 1: Current code (raw:true default) ===');
const wb1 = XLSX.readFile(filePath, { cellDates: false });
const ws1 = wb1.Sheets['Sheet1'];
const rows1 = XLSX.utils.sheet_to_json(ws1, { defval: '' });
console.log('First 5 data rows:');
rows1.slice(0, 5).forEach((r, i) => {
  console.log(`  Row ${i+1}: date=${JSON.stringify(r.Date)} (typeof=${typeof r.Date}) cement=${JSON.stringify(r.Cement)}`);
});

console.log('\n=== TEST 2: FIX — raw:false (use display strings) ===');
const wb2 = XLSX.readFile(filePath, { cellDates: false });
const ws2 = wb2.Sheets['Sheet1'];
const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: '', raw: false });
console.log('First 5 data rows:');
rows2.slice(0, 5).forEach((r, i) => {
  console.log(`  Row ${i+1}: date=${JSON.stringify(r.Date)} (typeof=${typeof r.Date}) cement=${JSON.stringify(r.Cement)}`);
});

console.log('\n=== TEST 3: Verify normalizeDate on display strings ===');
const { normalizeDate } = require('./src/lib/date-utils.ts');
// Can't import TS directly, so simulate
function normalizeDateSim(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const m = trimmed.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/);
    if (m) {
      const [, a, b, y] = m;
      let d, mo;
      if (Number(a) > 12 && Number(b) <= 12) { d = a; mo = b; }
      else if (Number(b) > 12 && Number(a) <= 12) { mo = a; d = b; }
      else { d = a; mo = b; } // Default DD-MM (Indian)
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return `NORMALIZE:${typeof value}:${JSON.stringify(value)}`;
}

console.log('Applying normalizeDate to display strings from raw:false:');
rows2.slice(0, 12).forEach((r, i) => {
  const original = r.Date;
  const normalized = normalizeDateSim(original);
  console.log(`  Row ${i+1}: "${original}" → ${normalized}`);
});
