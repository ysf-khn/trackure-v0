"use client";

import React from "react";
import { useItemImages } from "@/hooks/queries/use-item-images";
import { S3Image } from "@/components/ui/s3-image";

interface DebugImagesProps {
  itemId: string;
}

export function DebugImages({ itemId }: DebugImagesProps) {
  const { data: images, isLoading, error } = useItemImages(itemId);

  if (isLoading) return <div>Loading images...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Debug Images for Item: {itemId}</h3>
      <p>Found {images?.length || 0} images</p>

      {images && images.length > 0 ? (
        <div className="space-y-2 mt-4">
          {images.map((img) => {
            const imageUrl = img.storage_path;
            return (
              <div key={img.id} className="border p-2 rounded">
                <p>
                  <strong>ID:</strong> {img.id}
                </p>
                <p>
                  <strong>Storage Path:</strong> {img.storage_path || "N/A"}
                </p>
                <p>
                  <strong>File Name:</strong> {img.file_name || "N/A"}
                </p>
                <p>
                  <strong>Content Type:</strong> {img.content_type || "N/A"}
                </p>
                <p>
                  <strong>Remark ID:</strong>{" "}
                  {img.remark_id?.toString() || "N/A"}
                </p>
                <p>
                  <strong>Uploaded At:</strong>{" "}
                  {new Date(img.uploaded_at).toLocaleString()}
                </p>

                {imageUrl && (
                  <div className="mt-2">
                    <S3Image
                      src={imageUrl}
                      alt={img.file_name || "Test image"}
                      width={128}
                      height={128}
                      className="w-32 h-32 object-cover border"
                      onLoad={() =>
                        console.log("Image loaded successfully:", imageUrl)
                      }
                      onError={() => {
                        console.error("Image failed to load:", imageUrl);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          No images found for this item.
        </p>
      )}
    </div>
  );
}
