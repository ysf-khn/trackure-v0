import imageCompression from "browser-image-compression";

const MAX_IMAGE_WIDTH = 1920; // Max width 1080p
const MAX_IMAGE_HEIGHT = 1080; // Max height 1080p
const TARGET_IMAGE_SIZE_MB = 1; // Target size in MB

interface CompressImageOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  alwaysKeepResolution?: boolean;
  // ... add other browser-image-compression options if needed
}

/**
 * Compresses an image file using browser-image-compression.
 * @param imageFile The original image File object.
 * @param options Optional compression settings.
 * @returns A Promise that resolves with the compressed File object.
 */
export async function compressImage(
  imageFile: File,
  options?: CompressImageOptions
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: options?.maxSizeMB ?? TARGET_IMAGE_SIZE_MB,
    maxWidthOrHeight:
      options?.maxWidthOrHeight ?? Math.max(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT),
    useWebWorker: options?.useWebWorker ?? true,
    initialQuality: options?.initialQuality ?? 0.7,
    alwaysKeepResolution: options?.alwaysKeepResolution ?? false,
    // It's generally better to compress to a target size (maxSizeMB)
    // You can fine-tune other options like initialQuality as needed
  };

  console.log(
    `Original image size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`
  );

  try {
    const compressedFile = await imageCompression(imageFile, defaultOptions);
    console.log(
      `Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`
    );
    // Return as File object to potentially keep the original filename
    return new File([compressedFile], imageFile.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Image compression error:", error);
    // Fallback to original file if compression fails
    return imageFile;
  }
}
