"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client instance (useState ensures it's stable across re-renders)
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;
