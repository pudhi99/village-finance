import fs from 'fs';

const html = fs.readFileSync('scripts/sheet_raw.html', 'utf8');

// Look around 2013296151
const pos = html.indexOf('2013296151');
const chunk = html.substring(pos - 1500, pos + 2500);
console.log('Chunk around 2013296151:');
console.log(chunk);
