import fs from 'fs';

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

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values[0] && values[0].includes('మొత్తం')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

const edurlanka = parseCSV(fs.readFileSync('scripts/Edurlanka.csv', 'utf8'));
const kothapalli = parseCSV(fs.readFileSync('scripts/Kothapalli.csv', 'utf8'));

console.log('EDURLANKA CUSTOMERS:');
edurlanka.rows.forEach((r, idx) => {
  console.log(`${idx + 1}. [Date: ${r['తేదీ (Date)']}] ${r['ఆసామీ పేరు (Telugu Name)']} (${r['English Transliteration']}) - Amt: ${r['సొమ్ము (Amount)']} | Type: ${r['పేమెంట్ విధానం (Payment Type)'] || 'WEEKLY'} | W1: ${r['1 (10/10/26)']} | W2: ${r['2 (17/10/26)']} | W3: ${r['3 (24/10/26)']} | W4: ${r['4 (31/10/26)']}`);
});

console.log('\nKOTHAPALLI CUSTOMERS:');
kothapalli.rows.forEach((r, idx) => {
  console.log(`${idx + 1}. [Date: ${r['తేదీ (Date)']}] ${r['ఆసామీ పేరు (Telugu Name)']} (${r['English Transliteration']}) - Amt: ${r['సొమ్ము (Amount)']} | Type: ${r['పేమెంట్ విధానం (Payment Type)'] || 'WEEKLY'} | W1: ${r['1 (10/10/26)']} | W2: ${r['2 (17/10/26)']} | W3: ${r['3 (24/10/26)']} | W4: ${r['4 (31/10/26)']}`);
});
