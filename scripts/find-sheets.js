async function checkTabs() {
  const url = 'https://docs.google.com/spreadsheets/d/13mv7X_zyulBuvXjNrkksCOCzpCLzeOdDI1l8903c964/edit';
  const res = await fetch(url);
  const html = await res.text();
  
  // Find all tab definitions
  const regex = /"name":"([^"]+)".*?"sheetId":(\d+)/g;
  let m;
  const tabs = [];
  while ((m = regex.exec(html)) !== null) {
    tabs.push({ name: m[1], gid: m[2] });
  }

  // Also try bootstrap data
  const gidRegex = /gid=(\d+)/g;
  const gids = new Set();
  while ((m = gidRegex.exec(html)) !== null) {
    gids.add(m[1]);
  }

  console.log('Tabs regex found:', tabs);
  console.log('All unique GIDs found:', Array.from(gids));
}

checkTabs().catch(console.error);
