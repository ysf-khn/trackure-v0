import React from "react";

interface ItemListPlaceholderProps {
  selectedStageName: string | null;
}

export const ItemListPlaceholder: React.FC<ItemListPlaceholderProps> = ({
  selectedStageName,
}) => {
  if (!selectedStageName) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a stage from the sidebar to view items.
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-md bg-muted/40 h-full">
      <h2 className="text-lg font-semibold mb-4">
        Items in: {selectedStageName}
      </h2>
      <div className="flex items-center justify-center h-[calc(100%-40px)] text-muted-foreground italic">
        (Item list placeholder - Items for &quot;{selectedStageName}&quot; will
        appear here)
      </div>
    </div>
  );
};
