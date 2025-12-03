import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { computeSha256FromS3 } from './s3Client';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, '[]');
  if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, '{}');
}

async function processJob(job: any) {
  const { bucket, key } = job;
  console.log('Processing job:', key);
  try {
    const sha = await computeSha256FromS3(bucket, key);
    // Mock scan: pass if size small / random
    const scanResult = { passed: true, reason: 'mock-scan' };

    const metaRaw = fs.readFileSync(METADATA_FILE, 'utf8') || '{}';
    const meta = JSON.parse(metaRaw);
    meta[key] = {
      key,
      bucket,
      sha256: sha,
      scanned: true,
      scan: scanResult,
      processedAt: Date.now(),
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2));
    console.log('Job processed, metadata stored for', key);
  } catch (err) {
    console.error('Error processing job', err);
  }
}

async function pollLoop() {
  ensureDataFiles();
  console.log('Worker: starting poll loop (jobs file:', JOBS_FILE, ')');
  while (true) {
    try {
      const raw = fs.readFileSync(JOBS_FILE, 'utf8') || '[]';
      const arr = JSON.parse(raw);
      if (arr.length > 0) {
        const job = arr.shift();
        fs.writeFileSync(JOBS_FILE, JSON.stringify(arr, null, 2));
        await processJob(job);
      }
    } catch (err) {
      console.error('Worker loop error:', err);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

if (require.main === module) {
  pollLoop();
}
