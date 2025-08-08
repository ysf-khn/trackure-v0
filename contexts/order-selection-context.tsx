"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface OrderSelectionContextType {
  selectedOrderId: string | null;
  setSelectedOrderId: (orderId: string | null) => void;
  selectedOrderNumber: string | null;
  setSelectedOrderNumber: (orderNumber: string | null) => void;
  clearOrderSelection: () => void;
}

const OrderSelectionContext = createContext<OrderSelectionContextType | undefined>(
  undefined
);

export function OrderSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);

  const clearOrderSelection = useCallback(() => {
    setSelectedOrderId(null);
    setSelectedOrderNumber(null);
  }, []);

  return (
    <OrderSelectionContext.Provider
      value={{
        selectedOrderId,
        setSelectedOrderId,
        selectedOrderNumber,
        setSelectedOrderNumber,
        clearOrderSelection,
      }}
    >
      {children}
    </OrderSelectionContext.Provider>
  );
}

export function useOrderSelection() {
  const context = useContext(OrderSelectionContext);
  if (context === undefined) {
    throw new Error(
      "useOrderSelection must be used within an OrderSelectionProvider"
    );
  }
  return context;
}