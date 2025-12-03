const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');

const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const bucket = process.env.S3_BUCKET || 'test-bucket';

async function main() {
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log('Bucket created:', bucket);
  } catch (err) {
    if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
      console.log('Bucket already exists:', bucket);
    } else {
      console.error('Create bucket error:', err);
      process.exit(2);
    }
  }
}

main();
