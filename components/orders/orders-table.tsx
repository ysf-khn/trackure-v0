"use client";

import React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Updated type to use payment_status
type OrderSummary = {
  id: string;
  order_number: string;
  customer_name?: string;
  payment_status: string; // Changed from status
  created_at: string;
  item_count: number;
};

export const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "order_number",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Order #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <Link
        href={`/orders/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.getValue("order_number")}
      </Link>
    ),
  },
  {
    accessorKey: "customer_name",
    header: "Customer",
    cell: ({ row }) => row.getValue("customer_name") || "-",
  },
  {
    accessorKey: "payment_status", // Changed from status
    header: "Payment Status", // Updated header text
    cell: ({ row }) => {
      const status = row.getValue("payment_status") as string;
      // Basic mapping, adjust variants as needed for your actual statuses
      const variant: "default" | "secondary" | "destructive" | "outline" =
        status.toLowerCase() === "paid"
          ? "default" // Or maybe a success variant if you add one
          : status.toLowerCase() === "pending"
            ? "secondary"
            : status.toLowerCase() === "unpaid" ||
                status.toLowerCase() === "failed"
              ? "destructive"
              : "outline";

      // Center the badge
      return (
        <div className="text-center">
          <Badge variant={variant}>{status}</Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "item_count",
    header: () => <div className="text-right">Items</div>, // Align header right
    cell: ({ row }) => (
      // Align cell content right
      <div className="text-right font-medium">{row.getValue("item_count")}</div>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      // Improved date formatting
      return (
        <span>
          {date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      );
    },
  },
  // Add more columns as needed (e.g., Actions)
];

interface OrdersTableProps {
  data: OrderSummary[]; // Type already uses payment_status
}

export function OrdersTable({ data }: OrdersTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No orders found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
