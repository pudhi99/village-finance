import fs from 'fs';

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values[0] && values[0].includes('మొత్తం')) continue; // Skip total row
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const values = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

const edurlanka = parseCSV(fs.readFileSync('scripts/Edurlanka.csv', 'utf8'));
const kothapalli = parseCSV(fs.readFileSync('scripts/Kothapalli.csv', 'utf8'));
const ledger = parseCSV(fs.readFileSync('scripts/Ledger_Reconciliation.csv', 'utf8'));
const investments = parseCSV(fs.readFileSync('scripts/Investments.csv', 'utf8'));

console.log('Edurlanka count:', edurlanka.rows.length);
console.log('Kothapalli count:', kothapalli.rows.length);
console.log('Investments count:', investments.rows.length);
console.log('Ledger count:', ledger.rows.length);

console.log('\nSample Edurlanka row:');
console.log(edurlanka.rows[0]);
console.log('\nSample Kothapalli row:');
console.log(kothapalli.rows[0]);
