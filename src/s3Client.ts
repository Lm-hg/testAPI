import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

function createClient() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || (process.env.USE_MINIO === 'true' ? process.env.MINIO_ENDPOINT : undefined);

  const opts: any = { region };
  if (endpoint) {
    opts.endpoint = endpoint;
    opts.forcePathStyle = true;
    // If using MinIO or a custom endpoint, allow credentials from env MINIO_*
    const accessKey = process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    if (accessKey && secretKey) {
      opts.credentials = { accessKeyId: accessKey, secretAccessKey: secretKey };
    }
  }
  return new S3Client(opts);
}

const client = createClient();

export async function getPresignedPutUrl(bucket: string, key: string, contentType: string, expiresSeconds = 300) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresSeconds });
  return url;
}

export async function getPresignedGetUrl(bucket: string, key: string, expiresSeconds = 300) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresSeconds });
  return url;
}

export async function computeSha256FromS3(bucket: string, key: string) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);
  const stream = res.Body as any;
  const hash = crypto.createHash('sha256');
  return await new Promise<string>((resolve, reject) => {
    // handle if Body is a Buffer (some SDKs) or stream
    if (Buffer.isBuffer(stream)) {
      hash.update(stream);
      return resolve(hash.digest('hex'));
    }
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err: any) => reject(err));
  });
}
