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
  ColumnFiltersState,
  getFilteredRowModel,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Search,
  Calendar,
  Package,
  User,
  CreditCard,
  ExternalLink,
  Filter,
  CheckCircle2Icon,
  Clock,
  XCircleIcon,
  Handshake,
  HelpCircleIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Updated type to use payment_status
type OrderSummary = {
  id: string;
  order_number: string;
  customer_name?: string;
  payment_status: string; // Changed from status
  created_at: string;
  item_count: number;
};

// Enhanced payment status configuration
const getPaymentStatusConfig = (status: string) => {
  const lowerStatus = status.toLowerCase();

  switch (lowerStatus) {
    case "paid":
      return {
        variant: "default" as const,
        className: "bg-green-500 hover:bg-green-600 text-white",
        icon: <CheckCircle2Icon className="h-4 w-4" />,
      };
    case "pending":
      return {
        variant: "secondary" as const,
        className: "bg-yellow-500 hover:bg-yellow-600 text-white",
        icon: <Clock className="h-4 w-4" />,
      };
    case "unpaid":
    case "failed":
      return {
        variant: "destructive" as const,
        className: "bg-red-500 hover:bg-red-600 text-white",
        icon: <XCircleIcon className="h-4 w-4" />,
      };
    case "credit":
      return {
        variant: "outline" as const,
        className:
          "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
        icon: <CreditCard className="h-4 w-4" />,
      };
    case "lent":
      return {
        variant: "outline" as const,
        className:
          "bg-purple-500 hover:bg-purple-600 text-white border-purple-500",
        icon: <Handshake className="h-4 w-4" />,
      };
    default:
      return {
        variant: "outline" as const,
        className:
          "bg-muted-foreground hover:bg-muted-foreground/90 text-muted",
        icon: <HelpCircleIcon className="h-4 w-4" />,
      };
  }
};

export const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "order_number",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Order #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <Link
          href={`/orders/${row.original.order_number}`}
          className="font-medium text-primary hover:underline transition-colors"
        >
          {row.getValue("order_number")}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "customer_name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          <User className="mr-2 h-4 w-4" />
          Buyer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const customerName = row.getValue("customer_name") as string;
      return (
        <div className="flex items-center gap-2">
          {customerName ? (
            <>
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{customerName}</span>
            </>
          ) : (
            <span className="text-muted-foreground italic">No buyer</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "payment_status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Payment Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("payment_status") as string;
      const config = getPaymentStatusConfig(status);

      return (
        <div className="flex justify-center">
          <Badge
            variant={config.variant}
            className={cn("transition-colors duration-200", config.className)}
          >
            <span className="mr-1">{config.icon}</span>
            {status}
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "item_count",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Items
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const count = row.getValue("item_count") as number;
      return (
        <div className="text-right">
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
            <Package className="h-3 w-3" />
            <span className="font-medium">{count}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return (
        <div className="space-y-1">
          <div className="font-medium">
            {date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {diffDays === 1
              ? "Yesterday"
              : diffDays <= 7
                ? `${diffDays} days ago`
                : ""}
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const order = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link
                href={`/orders/${order.order_number}`}
                className="flex items-center"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/orders/${order.order_number}`}
                className="flex items-center"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Order
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order.id)}
              className="flex items-center"
            >
              Copy Order ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface OrdersTableProps {
  data: OrderSummary[];
}

export function OrdersTable({ data }: OrdersTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  // Get unique payment statuses for filter
  const paymentStatuses = React.useMemo(() => {
    const statuses = data.map((order) => order.payment_status);
    return Array.from(new Set(statuses));
  }, [data]);

  // Get payment status filter state
  const paymentStatusFilter = table
    .getColumn("payment_status")
    ?.getFilterValue() as string[] | undefined;
  const hasPaymentStatusFilter =
    paymentStatusFilter && paymentStatusFilter.length > 0;

  return (
    <div className="w-full">
      {/* Search and Filter Controls */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search orders, buyers..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-10"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Payment Status
                {hasPaymentStatusFilter && (
                  <Badge variant="secondary" className="ml-1">
                    {paymentStatusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by Payment Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  table.getColumn("payment_status")?.setFilterValue(undefined)
                }
              >
                All Statuses
              </DropdownMenuItem>
              {paymentStatuses.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() =>
                    table.getColumn("payment_status")?.setFilterValue([status])
                  }
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        getPaymentStatusConfig(status).className.includes(
                          "bg-green"
                        )
                          ? "bg-green-500"
                          : getPaymentStatusConfig(status).className.includes(
                                "bg-yellow"
                              )
                            ? "bg-yellow-500"
                            : getPaymentStatusConfig(status).className.includes(
                                  "bg-red"
                                )
                              ? "bg-red-500"
                              : getPaymentStatusConfig(
                                    status
                                  ).className.includes("bg-primary")
                                ? "bg-primary"
                                : getPaymentStatusConfig(
                                      status
                                    ).className.includes("bg-purple")
                                  ? "bg-purple-500"
                                  : "bg-muted-foreground"
                      }`}
                    />
                    {status}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {data.length} orders
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold">
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
            {table.getFilteredRowModel().rows?.length ? (
              table.getFilteredRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    // Optional: Navigate to order details on row click
                    // window.location.href = `/orders/${row.original.id}`;
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">No orders found</p>
                      <p className="text-sm text-muted-foreground">
                        {globalFilter ||
                        table.getState().columnFilters.length > 0
                          ? "Try adjusting your search or filters"
                          : "Create your first order to get started"}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
