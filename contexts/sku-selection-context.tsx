"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SKUSelectionContextType {
  selectedSKU: string | null;
  setSelectedSKU: (sku: string | null) => void;
}

const SKUSelectionContext = createContext<SKUSelectionContextType | undefined>(undefined);

const STORAGE_KEY = "trackure-selected-sku";

export function SKUSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedSKU, setSelectedSKU] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedSKU = localStorage.getItem(STORAGE_KEY);
      if (storedSKU) {
        setSelectedSKU(storedSKU);
      }
    } catch (error) {
      console.error("Error loading SKU from localStorage:", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage when SKU changes
  useEffect(() => {
    if (!isInitialized) return;

    try {
      if (selectedSKU) {
        localStorage.setItem(STORAGE_KEY, selectedSKU);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error saving SKU to localStorage:", error);
    }
  }, [selectedSKU, isInitialized]);

  return (
    <SKUSelectionContext.Provider value={{ selectedSKU, setSelectedSKU }}>
      {children}
    </SKUSelectionContext.Provider>
  );
}

export function useSKUSelection() {
  const context = useContext(SKUSelectionContext);
  if (context === undefined) {
    throw new Error("useSKUSelection must be used within a SKUSelectionProvider");
  }
  return context;
}