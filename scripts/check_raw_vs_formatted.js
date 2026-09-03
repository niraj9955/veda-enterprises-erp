const XLSX = require('xlsx');

const filePath = '/home/z/my-project/upload/Production.xlsx';

// Read with cellDates:false (current code setting)
const wb = XLSX.readFile(filePath, { cellDates: false });
const ws = wb.Sheets['Sheet1'];

console.log('=== Comparing raw value (v) vs formatted display (w) for date cells ===');
console.log('This shows the BUG: Excel internally stores the WRONG date serial when user types 12-07-2026');
console.log('(Excel interprets as MM-DD=Dec 7 instead of DD-MM=July 12) but DISPLAYS it correctly as 12-07-2026');
console.log();

for (let r = 8; r <= 12; r++) {
  const addr = `A${r}`;
  const cell = ws[addr];
  if (cell) {
    // cell.v = raw value (number serial when cellDates:false)
    // cell.w = formatted display string (what user sees)
    console.log(`Row ${r-1} (cell ${addr}):`);
    console.log(`  Raw stored value (v): ${JSON.stringify(cell.v)} ${typeof cell.v === 'number' ? '← Excel serial' : ''}`);
    console.log(`  Display shown (w):    ${JSON.stringify(cell.w)}`);
    
    if (typeof cell.v === 'number') {
      // Convert serial to date
      const ms = Math.round((cell.v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      console.log(`  Serial → ${y}-${m}-${day} (THIS is what our code currently uses)`);
      
      // What user MEANT based on the display string
      console.log(`  Display "${cell.w}" → user MEANT this date`);
    }
    console.log();
  }
}

console.log('=== THE BUG ===');
console.log('Excel stores serial for "05/06/2026" but display shows the same "05/06/2026" — ambiguous.');
console.log('When user types "12-07-2026" in Excel:');
console.log('  - If day <= 12 (ambiguous): Excel may store as MM-DD-YYYY (December 7, 2026)');
console.log('  - Excel cell DISPLAYS whatever format the cell uses (e.g. "12-07-2026")');
console.log('  - User sees "12-07-2026" and thinks it is July 12');
console.log('  - Our code reads serial → gets December 7 → wrong!');
console.log();
console.log('=== SOLUTION ===');
console.log('Use the FORMATTED DISPLAY STRING (cell.w) instead of the serial number.');
console.log('Then our normalizeDate() will correctly parse "12-07-2026" as DD-MM-YYYY → July 12.');
