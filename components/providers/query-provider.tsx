"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client instance with optimized defaults for cache invalidation
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Reduce stale time for better cache invalidation responsiveness
            staleTime: 30 * 1000, // 30 seconds (was 5 minutes)
            // Increase cache time for better performance
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            // Reduce retry attempts for faster error handling
            retry: 1,
            // Enable automatic refetch on window focus for critical updates
            refetchOnWindowFocus: true,
            // Enable refetch on reconnect for data consistency
            refetchOnReconnect: true,
            // Enable refetch on mount for fresh data
            refetchOnMount: 'always',
            // Network mode for better handling of offline scenarios
            networkMode: 'online',
          },
          mutations: {
            // Reduce retry attempts for mutations
            retry: 1,
            // Network mode for mutations
            networkMode: 'online',
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;
