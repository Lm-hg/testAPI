const { exec } = require('child_process');
const { spawn } = require('child_process');

function execAsync(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

async function waitForUrl(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log('Bringing up docker-compose...');
  await execAsync('docker-compose up -d');

  console.log('Waiting for MinIO on http://localhost:9000/ ...');
  await waitForUrl('http://localhost:9000/');

  console.log('Creating bucket...');
  await execAsync('node ./src/scripts/create_bucket.js', { env: { ...process.env, MINIO_ENDPOINT: 'http://localhost:9000', MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin', S3_BUCKET: 'test-bucket' } });

  console.log('Starting server (npm run dev)...');
  const dev = spawn('npm', ['run', 'dev'], { env: { ...process.env, USE_MINIO: 'true', MINIO_ENDPOINT: 'http://localhost:9000', MINIO_ACCESS_KEY: 'minioadmin', MINIO_SECRET_KEY: 'minioadmin', S3_BUCKET: 'test-bucket' }, stdio: ['ignore', 'pipe', 'pipe'] });

  dev.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  dev.stderr.on('data', d => process.stderr.write(`[server-err] ${d}`));

  try {
    await waitForUrl('http://localhost:3000/');
    console.log('Server ready, calling /upload/request');
    const resp = await fetch('http://localhost:3000/upload/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'it-test.txt', contentType: 'text/plain' }) });
    const json = await resp.json();
    console.log('Response:', json);
    if (!json.url || !json.key) throw new Error('Invalid response from /upload/request');
    console.log('Integration test passed');
  } catch (err) {
    console.error('Integration test failed:', err);
    throw err;
  } finally {
    console.log('Killing server...');
    dev.kill();
    console.log('Tearing down docker-compose...');
    await execAsync('docker-compose down');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
