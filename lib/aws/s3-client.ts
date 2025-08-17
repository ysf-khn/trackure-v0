import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "trakurebucket";
export const CLOUDFRONT_URL = process.env.AWS_S3_CLOUDFRONT_URL;

// Helper to get public URL for an S3 object
export function getS3PublicUrl(key: string): string {
  if (CLOUDFRONT_URL) {
    // Use CloudFront URL if available (recommended for production)
    return `${CLOUDFRONT_URL}/${key}`;
  }
  // Otherwise use direct S3 URL
  return `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
}

// Generate a presigned URL for uploading
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Generate a presigned URL for downloading (if bucket is private)
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Upload a file to S3
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);
}

// Delete a file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

// Check if a file exists in S3
export async function checkS3FileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

// List objects in a prefix
export async function listS3Objects(
  prefix: string,
  maxKeys: number = 1000
): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await s3Client.send(command);
  return response.Contents?.map((obj) => obj.Key!).filter(Boolean) || [];
}

// Generate S3 key for different types of uploads
export function generateS3Key(
  type: "item" | "sample" | "profile" | "vendor-payment",
  organizationId: string,
  entityId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

  switch (type) {
    case "item":
      return `items/${organizationId}/${entityId}/${timestamp}_${sanitizedFileName}`;
    case "sample":
      return `samples/${organizationId}/${entityId}/${timestamp}_${sanitizedFileName}`;
    case "profile":
      return `profiles/${organizationId}/${entityId}/${timestamp}_${sanitizedFileName}`;
    case "vendor-payment":
      return `vendor-payments/${organizationId}/${entityId}/${timestamp}_${sanitizedFileName}`;
    default:
      throw new Error(`Unknown upload type: ${type}`);
  }
}
