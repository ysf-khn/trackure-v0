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

### Core Database Schema

#### Multi-tenant Architecture
- **organizations** - Company/tenant isolation
- **profiles** - Links auth.users to organizations with roles
- **worker_permissions** - Granular permissions for Worker role

#### Workflow System
- **workflow_stages** - Main production stages (customizable per org)
- **workflow_sub_stages** - Detailed steps within stages
- **item_stage_allocations** - Tracks item quantities in each stage
- **item_movement_history** - Complete audit trail of movements

#### Item Management
- **item_master** - SKU catalog with specs
- **items** - Actual item instances with quantities
- **orders** - Customer orders with payment status
- **item_remarks** - Stage-specific comments/instructions

#### Composite Items (Multi-component products)
- **composite_item_definitions** - Defines composite SKUs
- **composite_item_components** - Components and quantities
- Items table extended with `composite_group_id` and `parent_composite_sku`

#### Advanced Features
- **packaging_reminders** - Lead-time based reminders
- **item_images** - Image attachments for items/remarks
- **feature_requests** - User feedback system

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