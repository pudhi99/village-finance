import fs from 'fs';

async function main() {
  const spreadsheetId = '13mv7X_zyulBuvXjNrkksCOCzpCLzeOdDI1l8903c964';
  
  // Try fetching gid=0 and gid=2013296151
  const testGids = ['0', '2013296151'];
  for (const gid of testGids) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    const res = await fetch(csvUrl);
    if (res.ok) {
      const text = await res.text();
      fs.writeFileSync(`scripts/tab_gid_${gid}.csv`, text, 'utf8');
      console.log(`Saved tab_gid_${gid}.csv (${text.length} bytes, ${text.split('\n').length} lines)`);
    } else {
      console.log(`Failed gid ${gid}: status ${res.status}`);
    }
  }

  // To find ALL tab names and GIDs, let's query the Google Visualization API or the HTML content
  const editUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const res = await fetch(editUrl);
  const html = await res.text();
  fs.writeFileSync('scripts/sheet_raw.html', html, 'utf8');
  console.log(`Saved sheet_raw.html (${html.length} bytes)`);
}

main().catch(console.error);

