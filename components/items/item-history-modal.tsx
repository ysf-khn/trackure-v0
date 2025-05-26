"use client";

import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  MessageSquareText,
  Image as ImageIcon,
  Camera,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ZoomIn,
} from "lucide-react";
import { ItemImage, useItemImages } from "@/hooks/queries/use-item-images";
import {
  RemarkWithProfile,
  useItemRemarks,
} from "@/hooks/queries/use-item-remarks";
import { PdfDownloadModal } from "./pdf-download-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface ImageViewerData {
  imageUrl: string;
  fileName: string;
  remarkText: string;
}

export function ItemHistoryModal({
  itemId,
  itemSku,
  isOpen,
  onOpenChange,
}: ItemHistoryModalProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Image viewer state
  const [viewingImage, setViewingImage] = useState<ImageViewerData | null>(
    null
  );

  // Fetch paginated history data
  const {
    data: historyResponse,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useItemHistory(itemId, currentPage, pageSize);

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

  // Function to get proxy URL to avoid CORS issues
  const getImageUrl = (storagePath: string): string | null => {
    if (!storagePath) {
      console.warn("Empty storage path provided");
      return null;
    }

    try {
      console.log("Generating proxy URL for storage path:", storagePath);

      // Use proxy URL with item-images bucket to avoid CORS issues
      const proxyUrl = `/api/images/${storagePath}?bucket=item-images`;

      console.log("Generated proxy URL:", proxyUrl);
      return proxyUrl;
    } catch (error) {
      console.error("Error generating proxy URL:", error);
      return null;
    }
  };

  // Combine and sort data, now including images
  const combinedData = React.useMemo(() => {
    // Wait for all data sources
    if (isLoadingHistory || isLoadingRemarks || isLoadingImages) {
      return null; // Indicate loading state
    }
    // Combine errors if any
    if (historyError || remarksError || imagesError) {
      console.error("Data fetching errors:", {
        historyError,
        remarksError,
        imagesError,
      });
      return { error: historyError || remarksError || imagesError };
    }
    if (!historyResponse?.data || !remarks || !images) {
      return []; // Should not happen if loading is false and no error, but good practice
    }

    console.log("Raw images data:", images);
    console.log("Raw remarks data:", remarks);

    // Create a map of remarkId -> images[] for quick lookup
    const imagesByRemarkId = new Map<number, ItemImage[]>();
    images.forEach((img) => {
      console.log(
        "Processing image:",
        img.id,
        "with remark_id:",
        img.remark_id,
        "type:",
        typeof img.remark_id
      );
      if (img.remark_id) {
        if (!imagesByRemarkId.has(img.remark_id)) {
          imagesByRemarkId.set(img.remark_id, []);
        }
        imagesByRemarkId.get(img.remark_id)?.push(img);
      }
    });

    console.log("Images by remark ID:", imagesByRemarkId);
    console.log(
      "Remark IDs from remarks:",
      remarks.map((r) => ({ id: r.id, type: typeof r.id }))
    );

    const typedHistory: CombinedHistoryItem[] = historyResponse.data.map(
      (entry) => ({
        ...entry,
        type: "history",
      })
    );
    // Attach images to remarks
    const typedRemarks: CombinedHistoryItem[] = remarks.map((remark) => {
      const attachedImages = imagesByRemarkId.get(remark.id) || [];
      console.log(
        `Remark ${remark.id} has ${attachedImages.length} images attached`
      );
      return {
        ...remark,
        type: "remark",
        images: attachedImages, // Attach associated images
      };
    });

    console.log("Typed remarks with images:", typedRemarks);

    const combined = [...typedHistory, ...typedRemarks];

    // Sort chronologically (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.type === "history" ? a.moved_at : a.timestamp);
      const dateB = new Date(b.type === "history" ? b.moved_at : b.timestamp);
      return dateB.getTime() - dateA.getTime(); // Descending order
    });

    return combined;
  }, [
    historyResponse,
    remarks,
    images,
    isLoadingHistory,
    isLoadingRemarks,
    isLoadingImages,
    historyError,
    remarksError,
    imagesError,
  ]);

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Handle image click
  const handleImageClick = (
    imageUrl: string,
    fileName: string,
    remarkText: string
  ) => {
    setViewingImage({
      imageUrl,
      fileName,
      remarkText,
    });
  };

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
                      <p className="mb-2">{item.text}</p>
                      {/* Debug info */}
                      {(() => {
                        console.log(
                          `Rendering remark ${item.id} with ${item.images?.length || 0} images`
                        );
                        return null;
                      })()}
                      {/* Image Thumbnails */}
                      {item.images && item.images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.images.map((img) => {
                            const imageUrl = getImageUrl(img.storage_path);
                            console.log(
                              "Generated image URL:",
                              imageUrl,
                              "for path:",
                              img.storage_path
                            );

                            return imageUrl ? (
                              <button
                                key={img.id}
                                onClick={() =>
                                  handleImageClick(
                                    imageUrl,
                                    img.file_name || "Image",
                                    item.text
                                  )
                                }
                                className="relative w-16 h-16 rounded border overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:opacity-80 transition-opacity group"
                                title="Click to view full image"
                              >
                                <img
                                  src={imageUrl}
                                  alt={img.file_name || "Uploaded image"}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    console.error(
                                      "Image failed to load:",
                                      imageUrl
                                    );
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                  <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                </div>
                              </button>
                            ) : (
                              // Placeholder for broken/missing image URL
                              <div
                                key={img.id}
                                className="w-16 h-16 rounded border flex items-center justify-center bg-secondary"
                                title="Image not available"
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

  const renderPaginationControls = () => {
    if (!historyResponse) return null;

    const {
      totalPages,
      currentPage: responsePage,
      hasNextPage,
      hasPreviousPage,
      totalCount,
    } = historyResponse;

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing page {responsePage} of {totalPages} ({totalCount} total
            records)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Rows per page:
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={!hasPreviousPage}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPreviousPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={!hasNextPage}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-none sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none 2xl:max-w-none w-[90vw] sm:w-[90vw] overflow-hidden !important">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  History & Remarks for Item: {itemSku || itemId}
                </DialogTitle>
                <DialogDescription>
                  Chronological log of movements, actions, and remarks for the
                  selected item.
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPdfModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogHeader>
          <div className="mt-4">
            {renderHistory()}
            {renderPaginationControls()}
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Download Modal */}
      <PdfDownloadModal
        itemId={itemId}
        itemSku={itemSku}
        isOpen={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
        totalHistoryCount={historyResponse?.totalCount || 0}
      />

      {/* Image Viewer Modal */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden p-0">
          <div className="relative h-full flex flex-col">
            {/* Image */}
            {viewingImage && (
              <div className="flex flex-col h-full">
                <div className="relative bg-black flex items-center justify-center flex-1 overflow-hidden">
                  <img
                    src={viewingImage.imageUrl}
                    alt={viewingImage.fileName}
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                    style={{ maxHeight: "calc(90vh - 120px)" }} // Account for remark section height
                    onError={(e) => {
                      console.error(
                        "Full image failed to load:",
                        viewingImage.imageUrl
                      );
                    }}
                  />
                </div>

                {/* Remark text at bottom */}
                <div className="p-4 bg-muted/30 border-t flex-shrink-0">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    Associated Remark:
                  </h4>
                  <p className="text-sm">{viewingImage.remarkText}</p>
                  {viewingImage.fileName && (
                    <p className="text-xs text-muted-foreground mt-2">
                      File: {viewingImage.fileName}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
