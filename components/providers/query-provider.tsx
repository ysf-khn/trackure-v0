"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client instance with optimized defaults
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Increase stale time to reduce unnecessary refetches
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Increase cache time for better performance
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            // Reduce retry attempts for faster error handling
            retry: 1,
            // Disable automatic refetch on window focus for better UX
            refetchOnWindowFocus: false,
            // Enable refetch on reconnect for data consistency
            refetchOnReconnect: true,
          },
          mutations: {
            // Reduce retry attempts for mutations
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;
