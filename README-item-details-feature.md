# Item Details Feature

## Overview

This feature provides a comprehensive view of individual items, showing all details including quantities spread across different workflow stages, movement history, and item-specific information.

## Features

### 📊 Comprehensive Item View

- **Item Details Page**: Dedicated page at `/items/[itemId]` showing complete item information
- **Stage Allocations**: Visual breakdown of quantities across all workflow stages and sub-stages
- **Movement History**: Complete timeline of item movements through the workflow
- **Summary Statistics**: Quick overview of total, completed, and in-progress quantities

### 🔗 Easy Navigation

- **Quick Access Links**: Added external link icons next to item SKUs in:
  - Item list tables (workflow stages)
  - Order items display
- **Breadcrumb Navigation**: Easy navigation back to dashboard or related order

### 📈 Visual Data Presentation

- **Progress Bars**: Visual completion percentage
- **Summary Cards**: Key metrics at a glance
- **Tabbed Interface**: Organized information in easy-to-navigate tabs
- **Stage Distribution**: Clear visualization of quantities per stage

## Implementation

### API Endpoint

- **GET `/api/items/[itemId]`**: Comprehensive item data endpoint
  - Item basic information
  - Stage allocations with workflow details
  - Movement history with user information
  - Summary statistics
  - Related counts (remarks, images)

### React Components

- **`ItemDetailsView`**: Main component for displaying item details
- **`useItemDetails`**: React Query hook for fetching item data
- **Enhanced item tables**: Added navigation links to item details

### Page Structure

```
/items/[itemId]/
├── Overview Tab
│   ├── Basic Information
│   ├── Order Information
│   └── Current Stage Distribution
├── Stage Allocations Tab
│   └── Detailed table of all allocations
├── Movement History Tab
│   └── Complete movement timeline
└── Item Details Tab
    └── Instance-specific attributes
```

## Data Structure

### Item Details Response

```typescript
interface ItemDetailsResponse {
  item: ItemDetails;
  allocations: StageAllocation[];
  allocationsByStage: AllocationsByStage[];
  history: MovementHistoryEntry[];
  summary: ItemDetailsSummary;
}
```

### Key Features

- **Real-time Data**: Uses React Query for efficient data fetching and caching
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error states and loading indicators
- **Performance**: Optimized queries and data processing

## Usage

### Accessing Item Details

1. **From Workflow Stages**: Click the external link icon next to any item SKU
2. **From Order Pages**: Click the external link icon next to item SKUs in order details
3. **Direct URL**: Navigate to `/items/[itemId]` directly

### Information Available

- **Basic Info**: SKU, buyer ID, status, creation date
- **Order Context**: Order number, customer name
- **Quantities**: Total, in workflow, completed, new pool
- **Stage Breakdown**: Exact quantities in each stage/sub-stage
- **History**: Complete movement timeline with timestamps and users
- **Documentation**: Count of remarks and images attached

### Actions Available

- **View History**: Open detailed history modal
- **View Order**: Navigate to related order
- **Download Reports**: Access to existing PDF and voucher downloads

## Benefits

1. **Complete Visibility**: See all item information in one place
2. **Better Tracking**: Understand exactly where quantities are located
3. **Historical Context**: Full movement history for audit trails
4. **Quick Navigation**: Easy access from existing workflows
5. **Mobile Friendly**: Responsive design for field use

## Technical Notes

- **Security**: Proper organization-based access control
- **Performance**: Efficient database queries with proper joins
- **Caching**: React Query provides intelligent caching
- **Type Safety**: Full TypeScript support throughout
- **Error Handling**: Comprehensive error states and fallbacks

## Future Enhancements

Potential future improvements:

- **Real-time Updates**: WebSocket integration for live updates
- **Bulk Actions**: Actions on multiple items from details view
- **Advanced Filtering**: Filter history and allocations
- **Export Options**: Export item details to various formats
- **Notifications**: Alerts for item status changes
