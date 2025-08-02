# Implementation Plan for Trackure Demo Improvements

## Overview
Based on my analysis of the current codebase and the demo feedback, here's a comprehensive plan to implement all 12 requested improvements. The changes are significant and will require careful planning to maintain backward compatibility.

## Phase 1: Database Schema Updates

### 1.1 SKU-Specific Workflows (Improvement #1, #12)
**Tables to add:**
- `sku_workflow_stages` - Workflow stages specific to each SKU
- `sku_workflow_sub_stages` - Sub-stages for SKU workflows
- `sku_workflow_templates` - Store completed workflows as templates

**Tables to modify:**
- Add `workflow_type` enum to items table ('organization' | 'sku')
- Add `sku` reference to workflow_stages (nullable, for SKU-specific stages)

### 1.2 Infinite Sub-Stage Nesting (Improvement #3)
**Updated Approach:**
Instead of fixed levels (stage → sub-stage → sub-sub-stage), implement a **self-referencing tree structure** that allows unlimited nesting depth.

**Tables to modify:**
- Convert `workflow_stages` to support self-referencing parent-child relationships
- Remove separate sub-stage tables in favor of unified tree structure
- Add `parent_stage_id`, `depth_level`, `full_path`, and `is_leaf_stage` fields

### 1.3 Enhanced Rework System (Improvement #2)
**Tables to modify:**
- Add `rework_type` enum to item_movement_history ('backward' | 'scrapped' | 'replaced')
- Add `replacement_item_id` to track replacement items
- Add `is_scrapped` boolean to items table

### 1.4 Vendor Management (Improvement #5, #9, #10)
**Tables to add:**
- `vendors` - Store vendor information
- `vendor_stage_pricing` - Price per vendor per stage per SKU
- Link vendors to stages/sub-stages for pricing

### 1.5 Sample Management (Improvement #4)
**Tables to add:**
- `samples` - Track physical samples
- `sample_attributes` - Store sample properties (shape, color, engraving, etc.)

### 1.6 Weight/Size Standardization (Improvement #6, #7)
**Tables to modify:**
- Remove `weight` field from instance_details
- Add structured fields: `net_weight_kg`, `gross_weight_kg`, `size_inches`
- Add `weight_unit` and `size_unit` preferences to organizations table

### 1.7 SKU Management Enhancement (Improvement #8, #11)
**Tables to add:**
- `sku_cost_calculations` - Store calculated costs for SKUs
- Add views/functions for SKU analytics

## Phase 2: Core Logic Updates

### 2.1 Workflow System Refactor
- Modify `lib/workflow-utils.ts` to support SKU-specific workflows
- Create workflow template system for reusing successful workflows
- Update workflow determination logic to check SKU first, then fallback to org

### 2.2 Rework System Enhancement
- Update rework API to handle "scrapped" items
- Implement item replacement logic with quantity preservation
- Add support for creating new items when replacements are needed

### 2.3 Infinite-Depth Stage Navigation
- Refactor `determineNextStage()` to traverse tree structure recursively
- Implement leaf-stage-only allocation (items only move to stages with no children)
- Update stage progression logic to handle unlimited nesting depth
- Create tree traversal utilities for finding next/previous leaf stages
- Modify UI components to display hierarchical tree with collapsible nodes

### 2.4 Vendor Integration
- Create vendor CRUD operations
- Implement stage-vendor-price associations
- Add cost calculation engine for workflow paths

### 2.5 Sample Management System
- Implement sample CRUD with flexible attributes
- Create sample tracking dashboard
- Link samples to SKUs/orders as needed

## Phase 3: API Updates

### 3.1 New API Endpoints
- `/api/vendors` - Vendor management
- `/api/samples` - Sample tracking
- `/api/sku-workflows` - SKU-specific workflow configuration
- `/api/sku-management/[sku]` - Comprehensive SKU data
- `/api/cost-calculations` - Price calculations

### 3.2 Modified Endpoints
- Update item movement APIs for enhanced rework
- Modify workflow APIs to support SKU-specific stages
- Enhance item creation to support standardized units

## Phase 4: UI/UX Updates

### 4.1 New Pages/Components
- Vendor management interface
- Sample tracking dashboard
- SKU management page with cost calculations
- Enhanced workflow editor for SKU-specific configurations

### 4.2 Updated Components
- Tree-based workflow editor with drag-and-drop for unlimited nesting
- Collapsible stage hierarchy with visual indentation
- "Add Sub-Stage" button available on any stage node
- Breadcrumb navigation for deep nested stages
- Rework modal with "scrapped" option
- Item forms with standardized weight/size inputs
- Stage views showing vendor pricing with full path context

## Phase 5: Migration Strategy

### 5.1 Data Migration
- Migrate existing workflows to support new structure
- Convert weight/size data to standardized format
- Preserve existing functionality during transition

### 5.2 Feature Flags
- Implement feature flags for gradual rollout
- Allow organizations to opt-in to SKU workflows
- Maintain backward compatibility

## Implementation Order

1. **Week 1-2**: Database schema updates and migrations
2. **Week 3-4**: Core logic refactoring (workflows, rework)
3. **Week 5-6**: Vendor and sample management
4. **Week 7-8**: UI updates and SKU management
5. **Week 9-10**: Testing, optimization, and migration tools

## Key Considerations

1. **Backward Compatibility**: Ensure existing workflows continue functioning
2. **Performance**: Index new tables appropriately for large datasets
3. **Permissions**: Extend worker permissions for new features
4. **Testing**: Comprehensive test coverage for critical paths

## Technical Details

### Database Schema Changes Summary

```sql
-- Updated workflow_stages with infinite nesting support
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY,
    parent_stage_id UUID NULL, -- Self-referencing for unlimited nesting
    organization_id UUID NOT NULL,
    sku TEXT NULL, -- For SKU-specific workflows
    name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    depth_level INTEGER NOT NULL DEFAULT 0, -- Track nesting depth
    full_path TEXT NOT NULL, -- e.g., "Plating > Copper > Vendor A Process"
    location TEXT,
    is_leaf_stage BOOLEAN DEFAULT true, -- True if no children (items only allocate to leaf stages)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (parent_stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id),
    
    -- Ensure sequence order is unique within same parent
    UNIQUE(parent_stage_id, organization_id, sku, sequence_order)
);

-- Updated item allocations for tree structure
ALTER TABLE item_stage_allocations 
ADD COLUMN stage_path TEXT, -- Full path for easy querying
ADD COLUMN is_leaf_allocation BOOLEAN DEFAULT true;

-- Vendor management
CREATE TABLE vendors (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    firm_name TEXT,
    gst TEXT,
    address TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Vendor pricing (simplified - only for leaf stages)
CREATE TABLE vendor_stage_pricing (
    id UUID PRIMARY KEY,
    vendor_id UUID NOT NULL,
    stage_id UUID NOT NULL, -- Can be any stage in the tree
    sku TEXT NOT NULL,
    organization_id UUID NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (stage_id) REFERENCES workflow_stages(id),
    FOREIGN KEY (sku, organization_id) REFERENCES item_master(sku, organization_id),
    
    -- Only leaf stages can have pricing
    CONSTRAINT leaf_stage_pricing CHECK (
        EXISTS (
            SELECT 1 FROM workflow_stages 
            WHERE id = stage_id AND is_leaf_stage = true
        )
    )
);

-- Sample management
CREATE TABLE samples (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE sample_attributes (
    id UUID PRIMARY KEY,
    sample_id UUID NOT NULL,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (sample_id) REFERENCES samples(id)
);

-- Indexes for tree traversal performance
CREATE INDEX idx_workflow_stages_parent ON workflow_stages(parent_stage_id);
CREATE INDEX idx_workflow_stages_path ON workflow_stages USING gin(to_tsvector('english', full_path));
CREATE INDEX idx_workflow_stages_org_sku ON workflow_stages(organization_id, sku);
CREATE INDEX idx_workflow_stages_leaf ON workflow_stages(is_leaf_stage);
```

### API Response Structure Examples

```typescript
// Updated WorkflowStage interface for tree structure
interface WorkflowStage {
  id: string;
  name: string;
  parent_stage_id: string | null;
  depth_level: number;
  full_path: string;
  sequence_order: number;
  children?: WorkflowStage[];
  is_leaf_stage: boolean;
  vendor_pricing?: VendorPricing[];
}

// SKU Management API Response
interface SKUManagementResponse {
  sku: string;
  name: string;
  master_details: any;
  workflow: {
    stages: WorkflowStage[]; // Now supports nested tree structure
    estimated_cost: number;
    vendor_assignments: VendorAssignment[];
  };
  samples: Sample[];
  active_items: {
    total_quantity: number;
    completed_quantity: number;
    in_progress_quantity: number;
  };
  cost_breakdown: {
    stage_costs: StageCost[];
    total_cost: number;
  };
}

// Enhanced Rework Request
interface EnhancedReworkRequest {
  items: ReworkItem[];
  rework_type: 'backward' | 'scrapped' | 'replaced';
  rework_reason: string;
  target_stage_id?: string;
  replacement_details?: {
    create_new_items: boolean;
    preserve_total_quantity: boolean;
  };
}

// Tree navigation utilities
interface StageTreeUtils {
  findNextLeafStage(currentStageId: string): WorkflowStage | null;
  findPreviousLeafStage(currentStageId: string): WorkflowStage | null;
  buildStageTree(stages: WorkflowStage[]): WorkflowStage[];
  getAllLeafStages(organizationId: string, sku?: string): WorkflowStage[];
  getStageDepth(stageId: string): number;
  getFullStagePath(stageId: string): string;
}
```

## Benefits of Infinite Nesting Approach

1. **Unlimited Flexibility**: Users can nest stages as deep as needed for their specific processes
2. **Scalable Architecture**: Tree structure handles any depth efficiently with proper indexing
3. **Maintainable Codebase**: Single table with self-referencing vs. multiple level-specific tables
4. **Query Friendly**: Full path storage enables easy searching/filtering across all levels
5. **Future Proof**: No schema changes needed when users want deeper nesting
6. **Performance Optimized**: Indexes on parent relationships and leaf-stage constraints

## Example Use Case Hierarchy
```
Plating (Main Stage)
├── Copper Plating (Sub-stage)
│   ├── Vendor A Process (Sub-sub-stage)
│   │   ├── Pre-cleaning (Sub-sub-sub-stage)
│   │   │   ├── Chemical Bath 1 (Level 4)
│   │   │   └── Rinse Cycle (Level 4)
│   │   ├── Plating Bath (Sub-sub-sub-stage)
│   │   └── Quality Check (Sub-sub-sub-stage)
│   └── Vendor B Process (Sub-sub-stage)
│       └── Different sub-processes... (unlimited depth)
├── Nickel Plating (Sub-stage)
│   └── Various vendor processes... (unlimited depth)
└── Gold Plating (Sub-stage)
    └── Premium processes... (unlimited depth)
```

## Migration Strategy for Tree Structure

### Existing Data Migration
```sql
-- Migrate existing workflow_stages (top level, no parent)
UPDATE workflow_stages SET 
    parent_stage_id = NULL,
    depth_level = 0,
    full_path = name,
    is_leaf_stage = (
        SELECT COUNT(*) = 0 
        FROM workflow_sub_stages 
        WHERE stage_id = workflow_stages.id
    );

-- Migrate existing workflow_sub_stages as children
INSERT INTO workflow_stages (
    parent_stage_id, organization_id, name, sequence_order,
    depth_level, full_path, is_leaf_stage, sku
)
SELECT 
    wss.stage_id,
    wss.organization_id,
    wss.name,
    wss.sequence_order,
    1, -- depth level 1
    CONCAT(ws.name, ' > ', wss.name),
    true, -- sub-stages become leaf stages initially
    NULL -- organization-level workflows initially
FROM workflow_sub_stages wss
JOIN workflow_stages ws ON wss.stage_id = ws.id;

-- Update parent stages to no longer be leaf stages
UPDATE workflow_stages 
SET is_leaf_stage = false 
WHERE id IN (
    SELECT DISTINCT parent_stage_id 
    FROM workflow_stages 
    WHERE parent_stage_id IS NOT NULL
);
```

## Next Steps

Once approved, I'll:
1. Begin creating detailed database migrations for tree structure
2. Implement recursive tree traversal utilities in `lib/workflow-utils.ts`
3. Build the enhanced workflow system with unlimited nesting
4. Create tree-based UI components with drag-and-drop
5. Implement vendor management module
6. Create the sample tracking system
7. Add comprehensive testing for tree operations

This plan addresses all 12 improvements while providing unlimited workflow flexibility and maintaining system stability.