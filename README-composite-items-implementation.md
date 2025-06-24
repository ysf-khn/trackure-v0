# Composite Items Implementation Plan

## Overview

This document outlines the implementation plan for adding composite items functionality to the Trackure system. Composite items are logical groupings of multiple sub-components where each sub-component flows through the workflow independently.

## Current Architecture Analysis

The current system is built around **single-piece items** with these key characteristics:

1. **Item Master**: SKU-based catalog (`item_master` table)
2. **Items**: Individual item instances in orders (`items` table)
3. **Workflow Tracking**: Items move through stages via `item_stage_allocations`
4. **Quantity Management**: Each item has `total_quantity` and `remaining_quantity`
5. **Movement History**: All movements tracked in `item_movement_history`

## Composite Items Concept

- **Composite Item** (e.g., "Complete Phone Case Set"): A logical grouping/definition of multiple parts
- **Sub-Components** (e.g., "Front Cover", "Back Cover", "Screen Protector"): The actual physical items that move through the workflow
- **No Assembly Step**: The composite item is "complete" when all its sub-components are complete
- **Independent Workflow**: Each sub-component moves through stages independently using existing workflow logic

## Implementation Plan

### Phase 1: Database Schema

#### New Tables

```sql
-- Composite Item Definitions (metadata/grouping)
CREATE TABLE public.composite_item_definitions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    composite_sku text NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL, -- e.g., "Complete Phone Case Set"
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (composite_sku, organization_id) REFERENCES public.item_master(sku, organization_id),
    UNIQUE(composite_sku, organization_id)
);

-- Components that make up a composite item
CREATE TABLE public.composite_item_components (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    composite_definition_id uuid NOT NULL REFERENCES public.composite_item_definitions(id) ON DELETE CASCADE,
    component_sku text NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quantity_per_composite integer NOT NULL CHECK (quantity_per_composite > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (component_sku, organization_id) REFERENCES public.item_master(sku, organization_id),
    UNIQUE(composite_definition_id, component_sku)
);
```

#### Extend Existing Tables

```sql
-- Add composite grouping to existing items table
ALTER TABLE public.items
ADD COLUMN composite_group_id uuid NULL, -- Links components of same composite instance
ADD COLUMN parent_composite_sku text NULL; -- Reference to what composite this component belongs to

-- Add composite flag to item_master
ALTER TABLE public.item_master
ADD COLUMN is_composite boolean NOT NULL DEFAULT false;
```

### Phase 2: Business Logic

#### Order Processing Enhancement

When user adds composite item to order:

1. Generate a unique `composite_group_id` (UUID)
2. Look up composite definition and its components
3. Create individual `items` records for each component
4. Set `composite_group_id` and `parent_composite_sku` for each component item
5. Each component follows existing workflow independently

#### Example Flow

**Order**: 2x "Complete Phone Case Set"

**Composite Definition**:

- Front Cover (1 per composite)
- Back Cover (1 per composite)
- Screen Protector (1 per composite)

**Creates Items**:

- Group A (composite_group_id: uuid-1):
  - 2x "Front Cover" (parent_composite_sku: "PHONE-CASE-SET")
  - 2x "Back Cover" (parent_composite_sku: "PHONE-CASE-SET")
  - 2x "Screen Protector" (parent_composite_sku: "PHONE-CASE-SET")
- Group B (composite_group_id: uuid-2):
  - 2x "Front Cover" (parent_composite_sku: "PHONE-CASE-SET")
  - 2x "Back Cover" (parent_composite_sku: "PHONE-CASE-SET")
  - 2x "Screen Protector" (parent_composite_sku: "PHONE-CASE-SET")

Each component item moves through the workflow using existing `item_stage_allocations` system.

### Phase 3: API Layer

#### New Endpoints

```typescript
// Composite item management
POST / api / composite - items; // Create composite item definition
GET / api / composite - items; // List composite items for organization
PUT / api / composite - items / [id]; // Update composite item definition
DELETE / api / composite - items / [id]; // Delete composite item definition

// Component management
GET / api / composite - items / [id] / components; // Get components for composite item
POST / api / composite - items / [id] / components; // Add component to composite item
PUT / api / composite - items / [id] / components / [componentId]; // Update component
DELETE / api / composite - items / [id] / components / [componentId]; // Remove component

// Order processing (enhanced existing)
POST / api / orders; // Enhanced to handle composite items
```

#### Enhanced Existing Endpoints

- **`/api/orders`**: Enhanced to create component items when composite item added
- **`/api/items`**: Include composite grouping information in responses
- **`/api/items/[itemId]`**: Show related composite components

### Phase 4: Frontend Implementation

#### New Components

```typescript
// Composite item management
-CompositeItemDefinitionForm - // Create/edit composite items
  CompositeItemsList - // List all composite item definitions
  CompositeComponentSelector - // Select and configure components
  // Order entry enhancement
  CompositeItemOrderPreview - // Show what components will be created
  // Tracking and views
  CompositeItemGroupCard - // Show composite item group status
  CompositeItemProgress; // Progress indicator for composite completion
```

#### Enhanced Existing Components

1. **Item List Table**:

   - Group rows by `composite_group_id`
   - Show composite item indicator
   - Expandable rows to see individual components
   - Composite completion progress indicator

2. **Order Entry**:

   - Detect composite items in item master
   - Show component preview before adding
   - Quantity multiplication for components

3. **Item Detail View**:
   - Show related composite components
   - Link to other components in same group

### Phase 5: Database Views and Functions

#### Composite Status View

```sql
CREATE VIEW public.composite_item_status AS
SELECT
    i.composite_group_id,
    i.parent_composite_sku,
    i.order_id,
    o.order_number,
    o.customer_name,
    COUNT(*) as total_components,
    COUNT(*) FILTER (WHERE i.remaining_quantity = 0) as completed_components,
    ROUND(
        (COUNT(*) FILTER (WHERE i.remaining_quantity = 0)::decimal / COUNT(*)) * 100,
        1
    ) as completion_percentage,
    CASE
        WHEN COUNT(*) FILTER (WHERE i.remaining_quantity = 0) = COUNT(*) THEN 'Completed'
        WHEN COUNT(*) FILTER (WHERE i.remaining_quantity = 0) = 0 THEN 'Not Started'
        ELSE 'In Progress'
    END as composite_status,
    MIN(i.created_at) as created_at,
    i.organization_id
FROM public.items i
JOIN public.orders o ON i.order_id = o.id
WHERE i.composite_group_id IS NOT NULL
GROUP BY
    i.composite_group_id,
    i.parent_composite_sku,
    i.order_id,
    o.order_number,
    o.customer_name,
    i.organization_id;
```

#### Helper Functions

```sql
-- Function to get composite item completion status
CREATE OR REPLACE FUNCTION public.get_composite_completion_status(
    p_composite_group_id uuid
)
RETURNS TABLE (
    total_components integer,
    completed_components integer,
    completion_percentage decimal,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::integer as total_components,
        COUNT(*) FILTER (WHERE remaining_quantity = 0)::integer as completed_components,
        ROUND(
            (COUNT(*) FILTER (WHERE remaining_quantity = 0)::decimal / COUNT(*)) * 100,
            1
        ) as completion_percentage,
        CASE
            WHEN COUNT(*) FILTER (WHERE remaining_quantity = 0) = COUNT(*) THEN 'Completed'
            WHEN COUNT(*) FILTER (WHERE remaining_quantity = 0) = 0 THEN 'Not Started'
            ELSE 'In Progress'
        END as status
    FROM public.items
    WHERE composite_group_id = p_composite_group_id;
END;
$$ LANGUAGE plpgsql;
```

### Phase 6: Migration Strategy

#### Backward Compatibility

- All existing items remain with `composite_group_id = NULL` and `parent_composite_sku = NULL`
- Existing workflows continue unchanged
- New composite functionality is purely additive
- No breaking changes to existing API endpoints

#### Migration Steps

1. **Database Migration**: Add new tables and columns with safe defaults
2. **API Enhancement**: Extend existing endpoints to handle composite data
3. **Frontend Enhancement**: Add composite UI components alongside existing ones
4. **Data Migration**: No data transformation needed for existing items

### Phase 7: Implementation Priority

#### High Priority (Core Functionality)

1. ✅ Database schema migration
2. ✅ Composite item definition management (CRUD)
3. ✅ Enhanced order processing for composite items
4. ✅ Basic composite grouping in item views

#### Medium Priority (Enhanced Features)

1. ✅ Composite item progress tracking
2. ✅ Bulk operations awareness for composite groups
3. ✅ Enhanced reporting with composite data
4. ✅ Component relationship visualization

#### Low Priority (Advanced Features)

1. 🔄 Multi-level composite items (composite within composite)
2. 🔄 Dynamic component substitution
3. 🔄 Component-level cost tracking
4. 🔄 Advanced composite analytics

## Key Benefits

1. **Minimal Disruption**: Leverages 90% of existing workflow functionality
2. **Clean Architecture**: Composite logic is additive, not intrusive
3. **Flexible**: Supports any number of components per composite item
4. **Backward Compatible**: Existing single items continue working unchanged
5. **Scalable**: Component tracking uses proven workflow system
6. **User-Friendly**: Progressive enhancement of existing UI

## Technical Considerations

### Performance

- Composite items will create more individual item records
- Indexing on `composite_group_id` will be important for grouping queries
- Views and aggregation queries should be optimized

### Data Integrity

- Strong referential integrity with cascading deletes
- Composite definitions cannot be deleted if active composite instances exist
- Component SKUs must exist in item_master before being added to composite

### User Experience

- Clear indication of composite vs simple items
- Progressive disclosure - don't overwhelm users who only use simple items
- Intuitive grouping and progress visualization

## Future Enhancements

### Potential Extensions

1. **Bill of Materials (BOM)**: More detailed component specifications
2. **Component Substitution**: Allow alternative components for same composite
3. **Multi-level Composites**: Composites that contain other composites
4. **Dynamic Composites**: Components determined at order time
5. **Component Dependencies**: Workflow dependencies between components

### Integration Opportunities

1. **Inventory Management**: Track component stock levels
2. **Cost Tracking**: Cost rollup from components to composite
3. **Quality Control**: Component-specific quality checkpoints
4. **Supplier Management**: Different suppliers for different components

## Implementation Timeline

### Week 1-2: Foundation

- Database migration
- Basic CRUD APIs for composite definitions
- Unit tests

### Week 3-4: Core Functionality

- Enhanced order processing
- Component item creation logic
- Integration tests

### Week 5-6: Frontend Basic

- Composite item definition UI
- Enhanced order entry
- Basic composite grouping in item lists

### Week 7-8: Enhanced UI

- Progress tracking
- Composite status views
- Bulk operations awareness

### Week 9-10: Polish & Testing

- User acceptance testing
- Performance optimization
- Documentation updates

## Success Metrics

1. **Functionality**: Users can create and order composite items successfully
2. **Performance**: No degradation in existing single-item workflows
3. **Usability**: Users intuitively understand composite vs simple items
4. **Data Integrity**: All composite relationships maintained correctly
5. **Scalability**: System handles expected composite item volumes

---

_This implementation plan maintains the core principle that composite items are logical groupings where individual sub-components flow through the existing workflow system independently, ensuring minimal disruption to current functionality while providing powerful new capabilities._
