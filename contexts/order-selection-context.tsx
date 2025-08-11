"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

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

const ORDER_ID_STORAGE_KEY = "trackure-selected-order-id";
const ORDER_NUMBER_STORAGE_KEY = "trackure-selected-order-number";

export function OrderSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedOrderId = localStorage.getItem(ORDER_ID_STORAGE_KEY);
      const storedOrderNumber = localStorage.getItem(ORDER_NUMBER_STORAGE_KEY);
      
      if (storedOrderId) {
        setSelectedOrderId(storedOrderId);
      }
      if (storedOrderNumber) {
        setSelectedOrderNumber(storedOrderNumber);
      }
    } catch (error) {
      console.error("Error loading order selection from localStorage:", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage when order selection changes
  useEffect(() => {
    if (!isInitialized) return;

    try {
      if (selectedOrderId) {
        localStorage.setItem(ORDER_ID_STORAGE_KEY, selectedOrderId);
      } else {
        localStorage.removeItem(ORDER_ID_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error saving order ID to localStorage:", error);
    }
  }, [selectedOrderId, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    try {
      if (selectedOrderNumber) {
        localStorage.setItem(ORDER_NUMBER_STORAGE_KEY, selectedOrderNumber);
      } else {
        localStorage.removeItem(ORDER_NUMBER_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error saving order number to localStorage:", error);
    }
  }, [selectedOrderNumber, isInitialized]);

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