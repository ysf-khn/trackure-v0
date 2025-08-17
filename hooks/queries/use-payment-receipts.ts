import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PaymentReceipt {
  id: string;
  payment_id: string;
  s3_key: string;
  file_name: string;
  file_size_bytes: number;
  content_type: string;
  uploaded_by: string;
  uploaded_at: string;
  signedUrl: string;
  publicUrl: string;
}

interface PaymentReceiptsResponse {
  receipts: PaymentReceipt[];
}

// Hook to fetch payment receipts
export function usePaymentReceipts(paymentId: string | null) {
  return useQuery({
    queryKey: ["payment-receipts", paymentId],
    queryFn: async (): Promise<PaymentReceiptsResponse> => {
      if (!paymentId) throw new Error("Payment ID is required");
      
      const response = await fetch(`/api/vendors/payments/${paymentId}/receipts`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Could not fetch payment receipts");
      }
      return response.json();
    },
    enabled: !!paymentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to upload payment receipt
export function useUploadPaymentReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      paymentId: string;
      file: File;
    }) => {
      // Get presigned upload URL
      const uploadUrlResponse = await fetch("/api/upload/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: data.file.name,
          contentType: data.file.type,
          type: "vendor-payment",
          entityId: data.paymentId,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json();
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      const { uploadUrl, s3Key } = await uploadUrlResponse.json();

      // Upload file to S3
      const s3Response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": data.file.type },
        body: data.file,
      });

      if (!s3Response.ok) {
        throw new Error("Failed to upload file to S3");
      }

      // Associate receipt with payment
      const receiptResponse = await fetch(
        `/api/vendors/payments/${data.paymentId}/receipts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            s3Key,
            fileName: data.file.name,
            fileSizeBytes: data.file.size,
            contentType: data.file.type,
          }),
        }
      );

      if (!receiptResponse.ok) {
        const errorData = await receiptResponse.json();
        throw new Error(errorData.error || "Failed to associate receipt with payment");
      }

      return receiptResponse.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["payment-receipts", variables.paymentId],
      });
      toast.success("Receipt uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload receipt: ${error.message}`);
    },
  });
}

// Hook to delete payment receipt
export function useDeletePaymentReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      paymentId: string;
      receiptId: string;
    }) => {
      const response = await fetch(
        `/api/vendors/payments/${data.paymentId}/receipts?receiptId=${data.receiptId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete receipt");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["payment-receipts", variables.paymentId],
      });
      toast.success("Receipt deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete receipt: ${error.message}`);
    },
  });
}

// Hook to get receipt download URL (refresh signed URL)
export function useRefreshReceiptUrl() {
  return useMutation({
    mutationFn: async (data: {
      paymentId: string;
      receiptId: string;
    }) => {
      const response = await fetch(
        `/api/vendors/payments/${data.paymentId}/receipts`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh receipt URL");
      }

      const result = await response.json();
      const receipt = result.receipts.find((r: PaymentReceipt) => r.id === data.receiptId);
      
      if (!receipt) {
        throw new Error("Receipt not found");
      }

      return receipt;
    },
    onError: (error: Error) => {
      toast.error(`Failed to refresh receipt URL: ${error.message}`);
    },
  });
}