"use client";

import React from "react";
import {
  useItemHistory,
  ItemHistoryEntry,
} from "@/hooks/queries/use-item-history";
import { formatDistanceToNow, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Image as ImageIcon, Camera } from "lucide-react";
import { ItemImage, useItemImages } from "@/hooks/queries/use-item-images";
import { createClient } from "@/utils/supabase/client";
import {
  RemarkWithProfile,
  useItemRemarks,
} from "@/hooks/queries/use-item-remarks";

// Update CombinedHistoryItem to potentially include images with remarks
interface RemarkWithImages extends RemarkWithProfile {
  images?: ItemImage[];
  type: "remark";
}

interface HistoryEntry extends ItemHistoryEntry {
  type: "history";
}

type CombinedHistoryItem = HistoryEntry | RemarkWithImages;

interface ItemHistoryModalProps {
  itemId: string | null;
  itemSku: string | null; // For displaying in the title
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const BUCKET_NAME = "item-images"; // Match the bucket name used in uploader

export function ItemHistoryModal({
  itemId,
  itemSku,
  isOpen,
  onOpenChange,
}: ItemHistoryModalProps) {
  const supabase = createClient(); // Get client for public URL generation
  const {
    data: history,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useItemHistory(itemId);
  const {
    data: remarks,
    isLoading: isLoadingRemarks,
    error: remarksError,
  } = useItemRemarks(itemId);
  const {
    data: images,
    isLoading: isLoadingImages, // Add loading state for images
    error: imagesError,
  } = useItemImages(itemId);

  // State for viewing image in a dialog (implement dialog separately)
  // const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  // Combine and sort data, now including images
  const combinedData = React.useMemo(() => {
    // Wait for all data sources
    if (isLoadingHistory || isLoadingRemarks || isLoadingImages) {
      return null; // Indicate loading state
    }
    // Combine errors if any
    if (historyError || remarksError || imagesError) {
      return { error: historyError || remarksError || imagesError };
    }
    if (!history || !remarks || !images) {
      return []; // Should not happen if loading is false and no error, but good practice
    }

    // Create a map of remarkId -> images[] for quick lookup
    const imagesByRemarkId = new Map<string, ItemImage[]>();
    images.forEach((img) => {
      if (img.remark_id) {
        if (!imagesByRemarkId.has(img.remark_id)) {
          imagesByRemarkId.set(img.remark_id, []);
        }
        imagesByRemarkId.get(img.remark_id)?.push(img);
      }
    });

    const typedHistory: CombinedHistoryItem[] = history.map((entry) => ({
      ...entry,
      type: "history",
    }));
    // Attach images to remarks
    const typedRemarks: CombinedHistoryItem[] = remarks.map((remark) => ({
      ...remark,
      type: "remark",
      images: imagesByRemarkId.get(remark.id) || [], // Attach associated images
    }));

    const combined = [...typedHistory, ...typedRemarks];

    // Sort chronologically (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.type === "history" ? a.moved_at : a.timestamp);
      const dateB = new Date(b.type === "history" ? b.moved_at : b.timestamp);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });

    return combined;
  }, [
    history,
    remarks,
    images,
    isLoadingHistory,
    isLoadingRemarks,
    isLoadingImages,
    historyError,
    remarksError,
    imagesError,
  ]);

  const renderHistory = () => {
    if (combinedData === null)
      return <p>Loading history, remarks, and images...</p>; // Loading state
    if (
      typeof combinedData === "object" &&
      "error" in combinedData &&
      combinedData.error
    ) {
      return (
        <p className="text-destructive">
          Error loading data: {combinedData.error.message}
        </p>
      );
    }
    if (!Array.isArray(combinedData) || combinedData.length === 0) {
      return <p>No history or remarks found for this item.</p>;
    }

    return (
      <ScrollArea className="h-[60vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinedData.map((item) => {
              if (item.type === "history") {
                return (
                  <TableRow key={`hist-${item.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {format(new Date(item.moved_at), "MMM d, yyyy")}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {format(new Date(item.moved_at), "h:mm a")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.rework_reason ? "destructive" : "default"}
                        className={
                          item.rework_reason
                            ? "bg-red-100 text-red-800 hover:bg-red-100"
                            : "bg-green-100 text-green-800 hover:bg-green-100"
                        }
                      >
                        {item.rework_reason ? "Rework" : "Move Forward"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.from_stage_name ? (
                        <>
                          Moved <strong>{item.quantity}</strong> items from{" "}
                          <strong>
                            {item.from_stage_name}
                            {item.from_sub_stage_name
                              ? ` / ${item.from_sub_stage_name}`
                              : ""}
                          </strong>{" "}
                          to{" "}
                          <strong>
                            {item.to_stage_name}
                            {item.to_sub_stage_name
                              ? ` / ${item.to_sub_stage_name}`
                              : ""}
                          </strong>
                        </>
                      ) : (
                        <>
                          Initially allocated <strong>{item.quantity}</strong>{" "}
                          items to{" "}
                          <strong>
                            {item.to_stage_name}
                            {item.to_sub_stage_name
                              ? ` / ${item.to_sub_stage_name}`
                              : ""}
                          </strong>
                        </>
                      )}
                      {item.rework_reason && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Rework Reason: {item.rework_reason}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              } else if (item.type === "remark") {
                // Function to get public URL
                const getImageUrl = (storagePath: string): string | null => {
                  if (!storagePath) return null;
                  const { data } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);
                  return data?.publicUrl ?? null;
                };

                return (
                  <TableRow
                    key={`rem-${item.id}`}
                    className="bg-muted/30 hover:bg-muted/50 align-top" // Align top for remarks with images
                  >
                    <TableCell className="pt-2">
                      <div className="flex flex-col">
                        <span>
                          {format(new Date(item.timestamp), "MMM d, yyyy")}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {format(new Date(item.timestamp), "h:mm a")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pt-2">
                      <Badge
                        variant="outline"
                        className="border-blue-500 text-blue-700"
                      >
                        <MessageSquareText className="h-3 w-3 mr-1" /> Remark
                        {item.images && item.images.length > 0 && (
                          <Camera className="h-3 w-3 ml-1 text-muted-foreground" /> // Indicate image attached
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words pt-2">
                      {/* Remark Text */}
                      <p>{item.text}</p>
                      {/* Image Thumbnails */}
                      {item.images && item.images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.images.map((img) => {
                            const imageUrl = getImageUrl(img.storage_path);
                            return imageUrl ? (
                              <button
                                key={img.id}
                                // onClick={() => setViewingImageUrl(imageUrl)} // Add onClick later for Dialog
                                className="w-16 h-16 rounded border overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                <img
                                  src={imageUrl}
                                  alt={img.file_name || "Uploaded image"}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              // Placeholder for broken/missing image URL
                              <div
                                key={img.id}
                                className="w-16 h-16 rounded border flex items-center justify-center bg-secondary"
                              >
                                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none 2xl:max-w-none w-[90vw] sm:w-[90vw] overflow-hidden !important">
        <DialogHeader>
          <DialogTitle>
            History & Remarks for Item: {itemSku || itemId}
          </DialogTitle>
          <DialogDescription>
            Chronological log of movements, actions, and remarks for the
            selected item.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">{renderHistory()}</div>
      </DialogContent>
    </Dialog>
  );
}
