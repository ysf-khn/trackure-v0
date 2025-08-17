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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History,
  FileText,
} from "lucide-react";
import { ItemImage, useItemImages } from "@/hooks/queries/use-item-images";
import {
  RemarkWithProfile,
  useItemRemarks,
} from "@/hooks/queries/use-item-remarks";
import { S3Image } from "@/components/ui/s3-image";
import { PdfDownloadModal } from "./pdf-download-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [activeTab, setActiveTab] = useState("history");

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
    isLoading: isLoadingImages,
    error: imagesError,
  } = useItemImages(itemId);

  // Function to get image URL (S3 or legacy)
  const getImageUrl = (img: ItemImage): string | null => {
    // Prefer S3 URL if available (for new S3 images)
    if (img.s3_url) {
      return img.s3_url;
    }
    
    // Fall back to legacy storage path if needed
    if (img.storage_path) {
      try {
        return `/api/images/${img.storage_path}?bucket=item-images`;
      } catch (error) {
        return null;
      }
    }
    
    return null;
  };

  // Create image map for remarks
  const imagesByRemarkId = React.useMemo(() => {
    if (!images) return new Map<number, ItemImage[]>();

    const map = new Map<number, ItemImage[]>();
    images.forEach((img) => {
      if (img.remark_id) {
        if (!map.has(img.remark_id)) {
          map.set(img.remark_id, []);
        }
        map.get(img.remark_id)?.push(img);
      }
    });
    return map;
  }, [images]);

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
    if (isLoadingHistory) {
      return <p>Loading history...</p>;
    }

    if (historyError) {
      return (
        <p className="text-destructive">
          Error loading history: {historyError.message}
        </p>
      );
    }

    if (!historyResponse?.data || historyResponse.data.length === 0) {
      return <p>No history found for this item.</p>;
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
            {historyResponse.data.map((item) => (
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
                      Initially allocated <strong>{item.quantity}</strong> items
                      to{" "}
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
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  };

  const renderRemarks = () => {
    if (isLoadingRemarks) {
      return <p>Loading remarks...</p>;
    }

    if (remarksError) {
      return (
        <p className="text-destructive">
          Error loading remarks: {remarksError.message}
        </p>
      );
    }

    if (!remarks || remarks.length === 0) {
      return <p>No remarks found for this item.</p>;
    }

    return (
      <ScrollArea className="h-[60vh]">
        <div className="p-4 space-y-4">
          {remarks.map((remark) => {
            const attachedImages = imagesByRemarkId.get(remark.id) || [];

            return (
              <div key={`remark-${remark.id}`} className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-4">
                  {/* Images First (if any) */}
                  {attachedImages.length > 0 && (
                    <div className="flex-shrink-0">
                      <div className="flex flex-wrap gap-2">
                        {attachedImages.map((img) => {
                          const imageUrl = getImageUrl(img);

                          return imageUrl ? (
                            <button
                              key={img.id}
                              onClick={() =>
                                handleImageClick(
                                  imageUrl,
                                  img.file_name || "Image",
                                  remark.text
                                )
                              }
                              className="relative w-16 h-16 rounded-lg border-2 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:scale-105 transition-all duration-200 group"
                              title="Click to view full image"
                            >
                              <S3Image
                                src={imageUrl}
                                alt={img.file_name || "Uploaded image"}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                objectFit="cover"
                                onError={() => {
                                  console.error(
                                    "Image failed to load:",
                                    imageUrl
                                  );
                                }}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-25 transition-all duration-200 flex items-center justify-center rounded">
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                              </div>
                            </button>
                          ) : (
                            <div
                              key={img.id}
                              className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted"
                              title="Image not available"
                            >
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Content Section - Remark, User, Timestamp */}
                  <div className="flex-1 min-w-0">
                    {/* Remark Text Second */}
                    <div className="mb-3">
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">
                        {remark.text}
                      </p>
                    </div>

                    {/* User and Timestamp in same row */}
                    <div className="flex items-center justify-between gap-4">
                      {/* User Third */}
                      <div className="flex-shrink-0">
                        <Badge
                          variant="outline"
                          className="border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <MessageSquareText className="h-3 w-3 mr-1.5" />
                          {remark.full_name || remark.created_by || "Unknown"}
                        </Badge>
                      </div>

                      {/* Timestamp Fourth */}
                      <div className="text-xs text-muted-foreground text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-medium">
                            {format(new Date(remark.timestamp), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          <span className="text-muted-foreground/70">
                            {formatDistanceToNow(new Date(remark.timestamp))} ago
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {remarks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquareText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No remarks found for this item.</p>
            </div>
          )}
        </div>
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
                className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 mr-10"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="history"
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Movement History
                </TabsTrigger>
                <TabsTrigger
                  value="remarks"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Remarks ({remarks?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                {renderHistory()}
                {activeTab === "history" && renderPaginationControls()}
              </TabsContent>

              <TabsContent value="remarks" className="mt-4">
                {renderRemarks()}
              </TabsContent>
            </Tabs>
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
                  <S3Image
                    src={viewingImage.imageUrl}
                    alt={viewingImage.fileName}
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                    objectFit="contain"
                    onError={() => {
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
