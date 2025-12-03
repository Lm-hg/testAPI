import { Router } from 'express';
import dotenv from 'dotenv';
import { getPresignedPutUrl } from '../s3Client';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, '[]');
  if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, '{}');
}

function pushJob(job: any) {
  ensureDataFiles();
  const raw = fs.readFileSync(JOBS_FILE, 'utf8');
  const arr = JSON.parse(raw || '[]');
  arr.push(job);
  fs.writeFileSync(JOBS_FILE, JSON.stringify(arr, null, 2));
}

function readMetadata() {
  ensureDataFiles();
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8') || '{}');
}

function writeMetadata(obj: any) {
  ensureDataFiles();
  fs.writeFileSync(METADATA_FILE, JSON.stringify(obj, null, 2));
}

dotenv.config();

const router = Router();

// Body: { filename, contentType, size }
router.post('/request', async (req, res, next) => {
  try {
    const { filename, contentType } = req.body ?? {};
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType required' });
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: 'S3_BUCKET not configured' });

    const key = `uploads/${Date.now()}-${filename}`;
    const url = await getPresignedPutUrl(bucket, key, contentType, 300);

    return res.json({ url, key, expiresIn: 300 });
  } catch (err) {
    next(err);
  }
});

// Called by client after successful upload (or by S3 event in prod)
// Body: { key }
router.post('/complete', async (req, res, next) => {
  try {
    const { key } = req.body ?? {};
    if (!key) return res.status(400).json({ error: 'key required' });

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: 'S3_BUCKET not configured' });

    const job = { bucket, key, timestamp: Date.now(), status: 'pending' };
    pushJob(job);
    return res.json({ ok: true, job });
  } catch (err) {
    next(err);
  }
});

// Retrieve metadata for a file
router.get('/:key/metadata', (req, res) => {
  try {
    const k = req.params.key;
    const meta = readMetadata();
    const entry = meta[k];
    if (!entry) return res.status(404).json({ error: 'not found' });
    return res.json(entry);
  } catch (err) {
    return res.status(500).json({ error: 'failed reading metadata' });
  }
});

// Return a presigned GET URL for download (or 403 if not allowed in prod)
router.get('/:key/download', async (req, res, next) => {
  try {
    const k = req.params.key;
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: 'S3_BUCKET not configured' });
    const { getPresignedGetUrl } = await import('../s3Client');
    const url = await getPresignedGetUrl(bucket, k, 300);
    return res.json({ url, expiresIn: 300 });
  } catch (err) {
    next(err);
  }
});

export default router;
