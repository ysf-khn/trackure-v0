# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trakure is a B2B SaaS application for export manufacturing firms to manage multi-stage production workflows. Built with Next.js 14 (App Router), TypeScript, Supabase, and TanStack Query.

## Key Commands

### Development
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint checking
npm run type-check   # TypeScript type checking
```

### Database
- Supabase project required (see `.env.example`)
- Migrations in `supabase/migrations/`
- RLS policies enforced for multi-tenant security

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI (via shadcn/ui), Lucide icons
- **State**: TanStack Query for server state, React Hook Form
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Payments**: DodoPayments integration
- **Email**: Resend for transactional emails

### Route Structure
- `/(app)/` - Authenticated application routes
  - `dashboard/` - Analytics dashboard
  - `orders/` - Order management
  - `items/[itemId]/` - Item details
  - `workflow/[stageId]/` - Stage-specific views
  - `settings/` - Configuration
  - `completed-items/` - Completed work
- `/(auth-pages)/` - Authentication flows
- `/(landing)/` - Public marketing pages
- `/(onboarding)/` - User onboarding flow
- `/api/` - REST API endpoints

### Core Database Schema (Detailed)

#### Multi-tenant Architecture
- **organizations**: `id` (uuid), `name` (text),`owner_id`, `created_at`, `weight_unit`, `size_unit`
- **profiles**: `id` (uuid), `organization_id`, `role` (Owner/Worker), `full_name`, `created_at`, `updated_at`
- **worker_permissions**: `id`, `organization_id`, `permission_key` (dot notation), `enabled` (boolean)

#### Workflow System (Tree Structure)
- **workflow_stages**: `id`, `name`, `sequence_order`, `organization_id`, `parent_stage_id` (self-ref), `depth_level`, `full_path`, `is_leaf_stage`, `sku`, `location`
  - Supports infinite nesting with tree structure
  - SKU-specific workflows
- **workflow_sub_stages**: Migrated into workflow_stages as child nodes
- **item_stage_allocations**: `id`, `item_id`, `stage_id`, `quantity`, `status`, `stage_path`, `is_leaf_allocation`
- **item_movement_history**: `id`, `item_id`, `from_stage_id`, `to_stage_id`, `quantity`, `moved_at`, `rework_reason`, `rework_type`, `replacement_item_id`

#### Item Management
- **item_master**: `sku` (text), `organization_id`, `master_details` (jsonb), `is_composite`, `created_at`
  - **NO item_name column - only sku**
  - Composite key: (sku, organization_id)
- **items**: `id`, `order_id`, `sku`, `total_quantity`, `remaining_quantity`, `status` (New/In Workflow/Completed), `is_scrapped`, `net_weight_kg`, `gross_weight_kg`
- **orders**: `id`, `order_number`, `customer_name`, `payment_status`, `status`, `total_quantity`
- **remarks**: `id`, `item_id`, `text`, `user_id`, `timestamp`

#### Cost Calculation
- **sku_cost_calculations**: `id`, `organization_id`, `sku`, `base_material_cost`, `total_workflow_cost`, `markup_percentage`, `final_calculated_cost`, `calculation_details` (jsonb)
  - **NO vendor_stage_costs or raw_material_cost columns**

#### Vendor Management
- **vendors**: `id`, `name`, `firm_name`, `gst`, `address`, `phone`, `email`, `is_active`
- **vendor_stage_pricing**: `id`, `vendor_id`, `stage_id`, `sku`, `price`, `currency`, `lead_time_days`

#### Sample Management
- **samples**: `id`, `sku`, `sample_code`, `name`, `status`, `location`
- **sample_attributes**: Flexible key-value attributes
- **sample_images**: Image attachments for samples

#### Composite Items
- **composite_item_definitions**: `id`, `composite_sku`, `organization_id`,`name`, `description`, `is_active`, `created_at`,`updated_at`
- **composite_item_components**: `id`, `composite_definition_id`, `component_sku`, `organization_id`, `quantity_per_composite`, `created_at`

#### Advanced Features
- **item_images**: `id`, `item_id`, `storage_path`, `remark_id`
- **feature_requests**: User feedback system with voting

### Key Business Logic

#### Workflow Movement
- Items move forward through stages via `item_stage_allocations`
- Rework sends items backward with reasons
- Partial quantities supported (split movements)
- Complete stage marked with special handling

#### Permission System
- Owner role: Full access
- Worker role: Restricted by `worker_permissions` table
- Real-time permission updates via WebSocket
- Stage-specific access control

#### Dashboard Analytics
- **get_dashboard_stats()** - Active orders, items, rework counts
- **get_bottleneck_items()** - Items stuck >7 days
- **get_movement_stats()** - Daily movement trends
- Optimized PostgreSQL functions for performance

### Data Flow
1. Server Components fetch initial data
2. Client Components use TanStack Query for caching/updates
3. Server Actions handle mutations
4. Realtime subscriptions for live updates (permissions)
5. Optimistic updates for better UX

### Important Files
- `middleware.ts` - Auth and routing logic
- `utils/supabase/` - Database client utilities
- `app/actions.ts` - Server actions
- `types/supabase.ts` - Generated database types
- `lib/permissions-stream.ts` - Realtime permissions
- `lib/workflow-utils.ts` - Core workflow logic
- `lib/plan-limits.ts` - Subscription plan enforcement

### Testing Approach
Check README or search for test scripts - no standard testing framework detected in package.json.

## Development Guidelines

### Database Operations
- Always use proper RLS policies
- Handle optimistic updates for better UX
- Use transactions for multi-table updates
- Check plan limits before operations

### Error Handling
- Server actions return `{ error: string }` on failure
- Client components show errors via toast notifications
- API routes return appropriate HTTP status codes
- Handle Supabase auth errors gracefully

### Performance
- Use React Server Components where possible
- Implement proper loading states
- Optimize images with Next.js Image component
- Use pagination for large data sets
- Dashboard uses cached PostgreSQL functions

### Security
- Environment variables for sensitive data
- RLS policies enforce data isolation
- Permission checks at multiple levels
- No client-side data manipulation
- Validate all inputs with Zod schemas

## Problem-Solving Techniques

### Analytical Review Process
- After planning, before reviewing the plan:
  * Critique your own output
  * Identify assumptions made
  * Highlight missed key details
  * Assess scalability of recommended solutions
  * Practice ultrathinking: Be brutally honest in self-evaluation

## Additional Notes

- Use all_tables.json to check the table schemas