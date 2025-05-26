"use client";

import React from "react";
import { useItemImages } from "@/hooks/queries/use-item-images";
import { createClient } from "@/utils/supabase/client";

interface DebugImagesProps {
  itemId: string;
}

const BUCKET_NAME = "item-images";

export function DebugImages({ itemId }: DebugImagesProps) {
  const supabase = createClient();
  const { data: images, isLoading, error } = useItemImages(itemId);

  const getImageUrl = (storagePath: string): string | null => {
    if (!storagePath) return null;

    try {
      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);
      return data?.publicUrl ?? null;
    } catch (error) {
      console.error("Error generating public URL:", error);
      return null;
    }
  };

  if (isLoading) return <div>Loading images...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Debug Images for Item: {itemId}</h3>
      <p>Found {images?.length || 0} images</p>

      {images && images.length > 0 ? (
        <div className="space-y-2 mt-4">
          {images.map((img) => {
            const imageUrl = getImageUrl(img.storage_path);
            return (
              <div key={img.id} className="border p-2 rounded">
                <p>
                  <strong>ID:</strong> {img.id}
                </p>
                <p>
                  <strong>Storage Path:</strong> {img.storage_path}
                </p>
                <p>
                  <strong>File Name:</strong> {img.file_name || "N/A"}
                </p>
                <p>
                  <strong>Remark ID:</strong>{" "}
                  {img.remark_id?.toString() || "N/A"}
                </p>
                <p>
                  <strong>Generated URL:</strong>{" "}
                  {imageUrl || "Failed to generate"}
                </p>

                {imageUrl && (
                  <div className="mt-2">
                    <img
                      src={imageUrl}
                      alt={img.file_name || "Test image"}
                      className="w-32 h-32 object-cover border"
                      onLoad={() =>
                        console.log("Image loaded successfully:", imageUrl)
                      }
                      onError={(e) => {
                        console.error("Image failed to load:", imageUrl);
                        console.error("Error event:", e);
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
