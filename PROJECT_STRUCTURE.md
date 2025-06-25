# Trackure Project Structure

## Overview

Trackure is a Next.js 14 application built with TypeScript that provides item tracking and workflow management capabilities. The project uses the modern App Router architecture and integrates with Supabase for backend services, featuring real-time updates, comprehensive authentication, and a modern UI built with Radix UI components.

## Root Directory Structure

### Core Application Files

- **`package.json`** - Project dependencies and scripts (React 19, Next.js latest, TanStack Query, Supabase)
- **`next.config.ts`** - Next.js configuration with bundle analyzer support
- **`tailwind.config.ts`** - Tailwind CSS configuration with custom animations
- **`tsconfig.json`** - TypeScript configuration
- **`middleware.ts`** - Next.js middleware for authentication and routing
- **`components.json`** - shadcn/ui components configuration

### Configuration Files

- **`postcss.config.js`** - PostCSS configuration for CSS processing
- **`.gitignore`** - Git ignore patterns
- **`next-env.d.ts`** - Next.js TypeScript declarations

### Documentation Files

- **`README.md`** - Main project documentation
- **`TRACKURE_COMPREHENSIVE_GUIDE.md`** - Comprehensive user guide
- **`TRACKURE_USER_GUIDE.md`** - User documentation
- **Feature-specific READMEs** - Documentation for specific features (composite items, permissions, etc.)

## Main Directories

### `/app` - Next.js App Router

The main application directory using Next.js 14 App Router architecture with route groups.

#### Core Application Files

- **`actions.ts`** - Server actions for form handling and data mutations
- **`layout.tsx`** - Root application layout with providers
- **`globals.css`** - Global CSS styles and Tailwind base styles

#### Route Groups

- **`(app)/`** - Main authenticated application routes

  - `dashboard/` - Analytics and overview dashboard
  - `orders/` - Order management and tracking
  - `items/` - Item tracking and management
  - `workflow/[stageId]/` - Workflow stage-specific views
  - `settings/` - Application configuration
  - `completed-items/` - Completed work tracking
  - `new-orders/` - New order creation interface

- **`(auth-pages)/`** - Authentication-related pages

  - `sign-in/` - User login interface
  - `sign-up/` - User registration
  - `forgot-password/` - Password recovery
  - `reset-password/` - Password reset interface

- **`(landing)/`** - Public marketing pages

  - `/` - Main landing page
  - `pricing/` - Pricing information and plans
  - `privacy-policy/` - Privacy policy
  - `terms-of-service/` - Terms of service

- **`(onboarding)/`** - User onboarding flow
  - `profile/` - User profile setup
  - `organization/` - Organization configuration
  - `setup-workflow/` - Initial workflow setup
  - `subscribe/` - Subscription selection
  - `invite/` - Team invitation handling

#### API Routes (`/api`)

RESTful API endpoints organized by feature:

**Dashboard & Analytics**

- `dashboard/stats/` - General dashboard statistics
- `dashboard/bottleneck-items/` - Items causing workflow bottlenecks
- `dashboard/movement-stats/` - Item movement analytics and trends

**Items Management**

- `items/` - Core item operations and listing
- `items/[itemId]/` - Individual item operations
  - `history-pdf/` - Generate item history PDF reports
  - `images/` - Item image management
  - `remarks/` - Item remarks and comments
- `items/export/` - Bulk item data export (CSV)
- `items/export-pdf/` - PDF export functionality
- `items/move/forward/` - Move items forward in workflow
- `items/move/rework/` - Rework items in workflow

**Composite Items**

- `composite-items/` - Composite item management
- `composite-items/[id]/` - Individual composite item operations
- `composite-items/parent-details/` - Parent-child relationships
- `composite-items/status/` - Status tracking

**Orders Management**

- `orders/` - Order listing and creation
- `orders/[orderId]/` - Individual order operations
  - `items/` - Order item management
  - `payment-status/` - Payment tracking

**Workflow Management**

- `workflow/` - Workflow configuration
- `settings/workflow/stages/` - Workflow stage management
  - `[stageId]/` - Individual stage operations
  - `reorder/` - Stage reordering
  - `sub-stages/` - Sub-stage management
- `settings/workflow/sub-stages/` - Sub-stage configuration
  - `[subStageId]/` - Individual sub-stage operations
  - `reorder/` - Sub-stage reordering

**Organization & Team**

- `organizations/` - Organization setup and management
- `organizations/[organizationId]/members/` - Member management
- `team/members/` - Team member operations
- `team/members/[memberId]/` - Individual member management
- `team/invites/` - Team invitation system

**Authentication & Permissions**

- `permissions/stream/[orgId]/` - Real-time permissions updates
- `settings/access-control/` - Access control configuration

**Billing & Subscriptions**

- `checkout/subscription/` - Stripe checkout integration
- `customer-portal/session/` - Billing portal access
- `subscription/` - Subscription management
  - `details/` - Subscription information
  - `sync-metadata/` - Metadata synchronization
  - `cleanup/` - Subscription cleanup processes

**Additional Features**

- `vouchers/[itemId]/` - Voucher generation
- `packaging-reminders/check/` - Packaging reminder system
- `plan-limits/check/` - Plan limitation checks
- `item-master/search/` - Item master search
- `profiles/` - User profile management
  - `me/` - Current user profile
  - `avatar/` - Avatar management
- `images/[...path]/` - Dynamic image serving
- `webhooks/dodo/` - DodoPayments webhook handling

### `/components` - React Components

Organized by feature and reusability using modern React patterns:

#### Core Application Components

- **`app-sidebar.tsx`** - Main application sidebar with navigation (17KB)
- **`site-header.tsx`** - Application header component
- **`dashboard-client.tsx`** - Client-side dashboard components
- **`data-table.tsx`** - Reusable data table with sorting/filtering (26KB)

#### Feature-Specific Components

**Items Management (`/items`)**

- `add-item-form.tsx` - Form for adding new items
- `item-list-table.tsx` - Data table for displaying items
- `item-table-core.tsx` - Core item table functionality
- `item-details-modal.tsx` - Modal for item details view
- `item-details-view.tsx` - Item details display component
- `item-history-modal.tsx` - Item history tracking interface
- `item-list-placeholder.tsx` - Loading state placeholder
- `add-remark-modal.tsx` - Add remarks to items
- `move-item-quantity-modal.tsx` - Move specific quantities
- `bulk-move-quantity-modal.tsx` - Bulk item movement
- `bulk-rework-quantity-modal.tsx` - Bulk rework operations
- `single-item-rework-quantity-modal.tsx` - Single item rework
- `rework-modal.tsx` - Rework item interface
- `pdf-download-modal.tsx` - PDF export interface
- `debug-images.tsx` - Image debugging component

**Orders Management (`/orders`)**

- `orders-table.tsx` - Orders data table
- `edit-order-form.tsx` - Order editing interface
- `order-details-display.tsx` - Order information display
- `order-items-display.tsx` - Order items listing
- `payment-status-editor.tsx` - Payment status management

**Composite Items (`/composite-items`)**

- `CompositeItemDefinitionForm.tsx` - Creating composite item definitions
- `CompositeItemProgress.tsx` - Progress tracking for composite items
- `CompositeItemsList.tsx` - Listing composite items
- `index.ts` - Composite items exports

**Settings (`/settings`)**

- `workflow-editor.tsx` - Workflow configuration interface
- `workflow-tab-content.tsx` - Workflow tab content management
- `add-stage-modal.tsx` - Add new workflow stages
- `edit-stage-modal.tsx` - Edit existing stages
- `delete-stage-dialog.tsx` - Delete stage confirmation
- `add-sub-stage-modal.tsx` - Add sub-stages
- `edit-sub-stage-modal.tsx` - Edit sub-stages
- `delete-sub-stage-dialog.tsx` - Delete sub-stage confirmation
- `plan-usage-section.tsx` - Subscription plan usage display

**Authentication (`/auth`)**

- `google-sign-in-button.tsx` - Google OAuth sign-in integration
- `google-sign-up-button.tsx` - Google OAuth sign-up integration

**Landing Page (`/landing-page`)**

- `hero.tsx` - Landing page hero section
- `navbar.tsx` - Landing page navigation
- `logo-navbar.tsx` - Logo navigation component
- `footer.tsx` - Landing page footer
- `problems.tsx` - Problem statement section
- `solutions.tsx` - Solution presentation
- `cta.tsx` - Call-to-action components
- `pricing/` - Pricing page components
  - `pricing-card.tsx` - Individual pricing plan cards
  - `pricing-header.tsx` - Pricing section header
  - `pricing-cta.tsx` - Pricing call-to-action
  - `billing-toggle.tsx` - Monthly/yearly billing toggle
  - `faq-section.tsx` - Frequently asked questions
  - `pricing-comparison.tsx` - Plan comparison table

**Navigation Components**

- `nav-main.tsx` - Main navigation menu
- `nav-secondary.tsx` - Secondary navigation
- `nav-user.tsx` - User profile navigation
- `nav-documents.tsx` - Document navigation

**Onboarding (`/onboarding`)**

- `onboarding-progress.tsx` - Progress indicator for onboarding flow

**Providers (`/providers`)**

- `permissions-provider.tsx` - Real-time permissions context
- `query-provider.tsx` - TanStack Query provider setup

**Charts & Visualization**

- `chart-area-interactive.tsx` - Interactive area charts (10KB)
- `chart-bar-interactive.tsx` - Interactive bar charts (9KB)
- `bottleneck-items-table.tsx` - Bottleneck analysis table

**Utility Components**

- `section-cards.tsx` - Dashboard section cards
- `plan-limits-alert.tsx` - Plan limitation alerts
- `trial-alert.tsx` - Trial period notifications
- `form-message.tsx` - Form validation messages
- `submit-button.tsx` - Form submission button
- `header-auth.tsx` - Header authentication display
- `header-auth-client.tsx` - Client-side auth header
- `env-var-warning.tsx` - Environment variable warnings
- `theme-switcher.tsx` - Dark/light theme toggle

#### UI Components (`/ui`)

Reusable UI components built with Radix UI and shadcn/ui:

**Form Controls**

- `button.tsx` - Button variants and states
- `input.tsx` - Text input component
- `textarea.tsx` - Multi-line text input
- `select.tsx` - Dropdown selection
- `checkbox.tsx` - Checkbox input
- `switch.tsx` - Toggle switch
- `label.tsx` - Form labels
- `form.tsx` - Form wrapper with validation

**Layout & Navigation**

- `card.tsx` - Content card container
- `dialog.tsx` - Modal dialog component
- `sheet.tsx` - Side panel component
- `drawer.tsx` - Mobile drawer component
- `sidebar.tsx` - Application sidebar (23KB)
- `breadcrumb.tsx` - Navigation breadcrumbs
- `separator.tsx` - Visual separators
- `tabs.tsx` - Tab navigation

**Data Display**

- `table.tsx` - Data table component
- `badge.tsx` - Status badges
- `avatar.tsx` - User avatar display
- `progress.tsx` - Progress indicators
- `skeleton.tsx` - Loading skeletons
- `chart.tsx` - Chart components (10KB)

**Feedback & Interaction**

- `alert.tsx` - Alert messages
- `alert-dialog.tsx` - Confirmation dialogs
- `tooltip.tsx` - Hover tooltips
- `popover.tsx` - Popup content
- `dropdown-menu.tsx` - Context menus
- `command.tsx` - Command palette
- `sonner.tsx` - Toast notifications

**Date & Time**

- `calendar.tsx` - Calendar picker
- `date-picker-with-range.tsx` - Date range selection

**Advanced Components**

- `accordion.tsx` - Collapsible content
- `collapsible.tsx` - Show/hide content
- `scroll-area.tsx` - Custom scrollbars
- `toggle.tsx` - Toggle buttons
- `toggle-group.tsx` - Toggle button groups
- `image-uploader.tsx` - File upload component (12KB)
- `markdown-renderer.tsx` - Markdown content display (7KB)
- `animated-button.tsx` - Button animations
- `animated-logo.tsx` - Logo animations
- `spinner.tsx` - Loading spinners

#### Mobile Utilities (`/hooks`)

- `use-mobile.ts` - Mobile device detection hook

### `/hooks` - Custom React Hooks

Organized by functionality using TanStack Query for server state:

#### Data Fetching Hooks (`/queries`)

- **`use-bottleneck-items.ts`** - Bottleneck analysis data
- **`use-completed-items-count.ts`** - Completion statistics
- **`use-dashboard-stats.ts`** - Dashboard overview data
- **`use-movement-stats.ts`** - Item movement analytics
- **`use-items-in-stage.ts`** - Stage-specific item data (6KB)
- **`use-item-details.ts`** - Individual item information
- **`use-item-history.ts`** - Item history tracking (5KB)
- **`use-item-images.ts`** - Item image management
- **`use-item-remarks.ts`** - Item remarks and comments
- **`use-order-items.ts`** - Order item relationships (4KB)
- **`use-workflow.ts`** - Workflow configuration data
- **`use-workflow-structure.ts`** - Workflow structure queries
- **`use-stage.ts`** - Individual stage data
- **`use-sub-stage.ts`** - Sub-stage information
- **`use-profileAndOrg.ts`** - User profile and organization data (3KB)
- **`use-subscription.ts`** - Subscription information
- **`use-plan-limits.ts`** - Plan limitation checks
- **`use-permission-check.ts`** - Permission validation
- **`use-new-items-count.ts`** - New item counters
- **`use-composite-items.ts`** - Composite item management (5KB)
- **`use-cached-image.ts`** - Image caching functionality

#### Data Mutation Hooks (`/mutations`)

- **`use-move-items-forward.ts`** - Moving items through workflow
- **`use-rework-items.ts`** - Reworking items

#### Utility Hooks

- **`use-mobile.ts`** - Mobile device detection
- **`use-avatar-url.ts`** - User avatar URL management
- **`use-debounce.ts`** - Input debouncing utility

### `/lib` - Utility Libraries

Core business logic and utilities:

#### External Integrations

- **`dodopayments.ts`** - DodoPayments integration for billing
- **`plans.ts`** - Subscription plan definitions and logic (3KB)
- **`plan-limits.ts`** - Plan limitation enforcement and checking (8KB)

#### Email & Notifications

- **`email/packaging-reminder.ts`** - Email notification system
- **`packaging-reminder-scheduler.ts`** - Automated reminder scheduling (9KB)

#### Data Processing

- **`image-utils.ts`** - Image processing and optimization utilities
- **`image-cache.ts`** - Image caching functionality
- **`item-history-utils.ts`** - Item history data processing (3KB)
- **`workflow-utils.ts`** - Workflow logic and utilities (10KB)

#### Database Queries (`/queries`)

- **`workflow.ts`** - Workflow-related database queries
- **`sub-stages.ts`** - Sub-stage management queries

#### System Utilities

- **`permissions-stream.ts`** - Real-time permissions updates
- **`subscription-cleanup.ts`** - Subscription cleanup processes
- **`utils.ts`** - General utility functions (cn, date formatting, etc.)

### `/types` - TypeScript Type Definitions

Comprehensive type safety across the application:

- **`api-types.ts`** - API request/response type definitions
- **`composite-items.ts`** - Composite item type definitions
- **`workflow.ts`** - Workflow-related type definitions
- **`supabase.ts`** - Auto-generated Supabase database types
- **`index.ts`** - Centralized type exports

### `/utils` - Utility Functions

Application-wide utilities organized by purpose:

#### Supabase Integration (`/supabase`)

- **`client.ts`** - Client-side Supabase configuration
- **`admin.ts`** - Admin client for server-side operations
- **`server.ts`** - Server-side Supabase utilities
- **`check-env-vars.ts`** - Environment variable validation
- **`auth.ts`** - Authentication utilities
- **`middleware.ts`** - Middleware-specific utilities

### `/supabase` - Database & Backend

Supabase configuration and database management:

#### Migrations (`/migrations`)

Chronologically ordered database schema evolution (30+ files):

- **`20250503100000_initial_schema.sql`** - Initial database schema (15KB)
- **`20250617000000_add_composite_items_support.sql`** - Composite items feature (14KB)
- **`20250115000000_add_dashboard_functions.sql`** - Dashboard analytics functions (6KB)
- **`20250510000000_add_completed_stage_system.sql`** - Completion tracking (7KB)
- **`20250529000000_worker_permissions.sql`** - Permissions system (4KB)
- **Storage setup scripts** - Profile images, item images
- **Feature migrations** - Packaging reminders, subscriptions, onboarding
- **Performance optimizations** - Allocation logic, RLS policies

#### Edge Functions (`/functions`)

Serverless functions running on Supabase Edge Runtime:

- **`packaging-reminder-scheduler/`** - Automated packaging reminders
  - `index.ts` - Cron job implementation
- **Storage setup scripts** - File storage bucket configuration

### `/public` - Static Assets

Public files served directly:

- **`favicon.ico`** - Site favicon
- **Images & Graphics**
  - `logo.svg` - Main application logo
  - `logo-black-bg.svg` - Logo for dark backgrounds
  - `logo-grey-bg.svg` - Logo for grey backgrounds
  - `landing-bg.png` - Landing page background
  - `dashboard-preview.png` - Dashboard screenshot
- **Feature Images**
  - `tracking.png` - Item tracking illustration
  - `history.png` - History feature illustration
  - `rework.png` - Rework process illustration
  - `truth.png` - Single source of truth illustration
- **Backgrounds & Assets**
  - `Background.svg` - General background pattern
  - `bg-features.png/.svg` - Feature section backgrounds
  - `googlelogo.png` - Google OAuth branding

### `/memory-bank` - Documentation & Knowledge Base

Project documentation and development history:

- **`trackure-prd.md`** - Product Requirements Document
- **`implementation-plan.md`** - Development phases and planning
- **`dashboard.md`** - Dashboard feature documentation
- **`workflow.md`** - Workflow system documentation
- **`onboarding-flow.md`** - User onboarding process
- **`example-scenario.md`** - Usage scenarios
- **Phase documentation** - Development phase records
- **Completed implementations** - Feature completion records

## Key Features & Architecture

### Technology Stack

- **Frontend**: React 19, Next.js 14 with App Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **State Management**: TanStack Query for server state, React Hook Form for forms
- **Type Safety**: TypeScript throughout with Zod validation
- **Payment Processing**: DodoPayments integration
- **Email**: Resend for transactional emails

### Authentication & Authorization

- **Supabase Auth** - Email/password and Google OAuth
- **Row Level Security (RLS)** - Database-level security policies
- **Real-time permissions** - Live permission updates via WebSocket
- **Role-based access control** - Granular permission system
- **Organization-scoped data** - Multi-tenant architecture

### Data Management

- **PostgreSQL** - Primary database with advanced features
- **Real-time subscriptions** - Live data updates across clients
- **File storage** - Supabase Storage for images and documents
- **Data export capabilities** - PDF and CSV exports with custom formatting
- **Comprehensive audit trails** - Complete item history tracking

### UI/UX Framework

- **Responsive design** - Mobile-first approach with container queries
- **Dark/light themes** - System-aware theme switching
- **Accessibility** - ARIA-compliant components
- **Progressive enhancement** - Works without JavaScript
- **Performance optimized** - Code splitting and lazy loading

### Development & Build Tools

- **TypeScript 5.7** - Latest TypeScript features
- **Turbopack** - Fast development builds
- **Bundle analyzer** - Production bundle optimization
- **ESLint & Prettier** - Code quality and formatting
- **Vercel deployment** - Edge network deployment

## Routing Structure

### Public Routes

- `/` - Landing page with hero and features
- `/pricing` - Pricing plans and subscription options
- `/privacy-policy` - Privacy policy and data handling
- `/terms-of-service` - Terms of service and usage policies

### Authentication Routes

- `/sign-in` - User login with Google OAuth
- `/sign-up` - User registration and account creation
- `/forgot-password` - Password recovery flow
- `/reset-password` - Password reset interface

### Application Routes (Authenticated)

- `/dashboard` - Analytics dashboard with real-time stats
- `/orders` - Order management and tracking
- `/orders/new` - Create new orders
- `/orders/[slug]` - Individual order details
- `/items/[itemId]` - Individual item tracking
- `/workflow/[stageId]` - Workflow stage-specific views
- `/completed-items` - Completed work tracking and history
- `/new-orders` - New order processing interface

### Settings & Configuration

- `/settings` - Main settings dashboard
- `/settings/account` - User account management
- `/settings/organization` - Organization configuration
- `/settings/workflow` - Workflow setup and management
- `/settings/access-control` - Team permissions and roles
- `/settings/billing` - Subscription and billing management

### Onboarding Routes

- `/profile` - User profile setup and configuration
- `/organization` - Organization setup and branding
- `/setup-workflow` - Initial workflow configuration
- `/subscribe` - Subscription plan selection
- `/invite` - Team invitation acceptance

This structure reflects a comprehensive, production-ready SaaS application with sophisticated workflow management, real-time collaboration features, and enterprise-grade security and scalability considerations.
