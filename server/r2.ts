import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

const enabled = Boolean(accountId && accessKeyId && secretAccessKey && bucket);

const client = enabled
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

export function isR2Enabled() {
  return enabled;
}

export function requireR2() {
  if (!enabled || !client || !bucket) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.");
  }
  return { client, bucket };
}

export async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const { client, bucket } = requireR2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = publicBase
    ? `${publicBase}/${params.key}`
    : `/api/r2/${encodeURIComponent(params.key)}`;

  return { key: params.key, url };
}

export async function getFromR2(key: string) {
  const { client, bucket } = requireR2();
  return client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function deleteFromR2(key: string) {
  const { client, bucket } = requireR2();
  return client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}
