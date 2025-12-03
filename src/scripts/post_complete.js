const fetch = global.fetch || require('node-fetch');
(async () => {
  const url = 'http://localhost:3000/upload/complete';
  const body = { key: process.argv[2] || 'uploads/test-file.txt' };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text();
    console.log('status', r.status, t);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
