import sharp from "sharp";
import { uploadToS3, generateS3Key, getS3PublicUrl } from "./s3-client";

export interface UploadOptions {
  file: File | Buffer;
  fileName: string;
  contentType: string;
  organizationId: string;
  entityId: string;
  type: "item" | "sample" | "profile" | "vendor-payment";
  maxSizeMB?: number;
  compress?: boolean;
}

export interface UploadResult {
  s3Key: string;
  s3Url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

// Compress image using sharp
export async function compressImage(
  input: Buffer,
  contentType: string,
  maxWidth: number = 1920,
  quality: number = 85
): Promise<Buffer> {
  let sharpInstance = sharp(input);

  // Get metadata to check dimensions
  const metadata = await sharpInstance.metadata();

  // Only resize if larger than maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    sharpInstance = sharpInstance.resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  // Apply format-specific compression
  if (contentType === "image/jpeg" || contentType === "image/jpg") {
    return await sharpInstance.jpeg({ quality, progressive: true }).toBuffer();
  } else if (contentType === "image/png") {
    return await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
  } else if (contentType === "image/webp") {
    return await sharpInstance.webp({ quality }).toBuffer();
  } else {
    // For other formats, just pass through with basic optimization
    return await sharpInstance.toBuffer();
  }
}

// Validate file size
export function validateFileSize(
  sizeInBytes: number,
  maxSizeMB: number = 10
): void {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (sizeInBytes > maxSizeBytes) {
    throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
  }
}

// Validate content type
export function validateContentType(contentType: string): void {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (!allowedTypes.includes(contentType)) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
    );
  }
}

// Main upload function for server-side uploads
export async function uploadImageToS3(
  options: UploadOptions
): Promise<UploadResult> {
  const {
    file,
    fileName,
    contentType,
    organizationId,
    entityId,
    type,
    maxSizeMB = 10,
    compress = true,
  } = options;

  // Validate content type
  validateContentType(contentType);

  // Convert File to Buffer if needed
  let buffer: Buffer;
  if (file instanceof Buffer) {
    buffer = file;
  } else {
    //@ts-ignore
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  // Validate file size
  validateFileSize(buffer.length, maxSizeMB);

  // Compress image if enabled and it's an image
  let processedBuffer = buffer;
  if (
    compress &&
    contentType.startsWith("image/") &&
    contentType !== "image/svg+xml"
  ) {
    try {
      processedBuffer = await compressImage(buffer, contentType);
    } catch (error) {
      console.error("Image compression failed, using original:", error);
      processedBuffer = buffer;
    }
  }

  // Generate S3 key
  const s3Key = generateS3Key(type, organizationId, entityId, fileName);

  // Upload to S3
  await uploadToS3(s3Key, processedBuffer, contentType, {
    originalFileName: fileName,
    organizationId,
    entityId,
    uploadType: type,
  });

  // Get public URL
  const s3Url = getS3PublicUrl(s3Key);

  return {
    s3Key,
    s3Url,
    fileName,
    fileSize: processedBuffer.length,
    contentType,
  };
}

// Helper function to handle FormData file uploads in API routes
export async function processFormDataFile(formData: FormData): Promise<{
  file: Buffer;
  fileName: string;
  contentType: string;
}> {
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    file: buffer,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  };
}
