const XLSX = require('xlsx');

const filePath = '/home/z/my-project/upload/Production.xlsx';

console.log('=== TEST: With raw:false — what does Excel give us for date cells? ===');
const wb = XLSX.readFile(filePath, { cellDates: false });
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

// Simulate normalizeDate for testing
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
    return `???:${trimmed}`;
  }
  return `RAW:${typeof value}:${value}`;
}

console.log('Date column values (raw:false) → normalized result:');
rows.forEach((r, i) => {
  const original = r.Date;
  const normalized = normalizeDateSim(original);
  console.log(`  Row ${i+1}: ${JSON.stringify(original)} → ${normalized}`);
});

console.log('\n=== TEST: Current code (raw:true default) — for comparison ===');
const wb2 = XLSX.readFile(filePath, { cellDates: false });
const ws2 = wb2.Sheets['Sheet1'];
const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: '' });
console.log('Date column values (raw:true) → normalized result:');
rows2.forEach((r, i) => {
  const original = r.Date;
  const normalized = normalizeDateSim(original);
  console.log(`  Row ${i+1}: ${JSON.stringify(original)} (typeof=${typeof original}) → ${normalized}`);
});
