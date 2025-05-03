# Trackure V1 - Implementation Plan: Phase 1 Detailed Tasks

**Phase Goal:** Define the database schema for core entities (organizations, users, workflow, orders, items, history, remarks, item master), implement basic Row Level Security (RLS) for multi-tenancy, and display the default workflow structure dynamically in the UI sidebar.

---

## Tasks Breakdown:

**1. Database Schema Design & Implementation (Supabase/PostgreSQL):**

- **1.1. Design Tables:** Define the structure for essential V1 tables.
  - `organizations`: `id (uuid, pk)`, `name (text)`, `created_at (timestamptz)`.
  - `profiles`: `id (uuid, pk, references auth.users)`, `organization_id (uuid, fk->organizations)`, `role (text, default 'Worker')`, `full_name (text, nullable)`, `updated_at (timestamptz)`.
  - `workflow_stages`: `id (uuid, pk)`, `name (text)`, `sequence_order (integer)`, `organization_id (uuid, fk->organizations)`, `is_default (boolean, default true)`.
  - `workflow_sub_stages`: `id (uuid, pk)`, `name (text)`, `sequence_order (integer)`, `stage_id (uuid, fk->workflow_stages)`, `organization_id (uuid, fk->organizations)`, `is_default (boolean, default true)`.
  - `orders`: `id (uuid, pk)`, `organization_id (uuid, fk->organizations)`, `order_number (text, nullable)`, `customer_name (text, nullable)`, `payment_status (text, nullable)`, `created_at (timestamptz)`.
  - `items`: `id (uuid, pk)`, `order_id (uuid, fk->orders)`, `sku (text, not null)`, `instance_details (jsonb, nullable)`, `current_stage_id (uuid, fk->workflow_stages, nullable)`, `current_sub_stage_id (uuid, fk->workflow_sub_stages, nullable)`, `organization_id (uuid, fk->organizations)`, `created_at (timestamptz)`.
  - `item_history`: `id (bigserial, pk)`, `item_id (uuid, fk->items)`, `stage_id (uuid, fk->workflow_stages, nullable)`, `sub_stage_id (uuid, fk->workflow_sub_stages, nullable)`, `entered_at (timestamptz)`, `exited_at (timestamptz, nullable)`, `user_id (uuid, fk->auth.users, nullable)`, `organization_id (uuid, fk->organizations)`, `rework_reason (text, nullable)`.
  - `remarks`: `id (bigserial, pk)`, `item_id (uuid, fk->items)`, `history_id (bigint, fk->item_history, nullable)`, `user_id (uuid, fk->auth.users)`, `text (text, not null)`, `timestamp (timestamptz)`, `organization_id (uuid, fk->organizations)`.
  - `item_master`: `sku (text, not null)`, `organization_id (uuid, fk->organizations, not null)`, `master_details (jsonb, nullable)`, `created_at (timestamptz)`. (Composite Primary Key: `(sku, organization_id)`).
- **1.2. Implement Schemas:**
  - Use Supabase SQL Editor or local migrations (`supabase/migrations`) to create these tables.
  - Define Primary Keys (PK), Foreign Keys (FK), `NOT NULL` constraints, and default values.
- **1.3. Seed Default Workflow:**
  - Create SQL script or use Supabase dashboard to insert the default `workflow_stages` and `workflow_sub_stages` records (marked with `is_default = true`). Assign these a placeholder/system `organization_id` or handle appropriately during tenant setup later. _Decision: For now, assume they are global defaults identifiable by `is_default=true` and potentially a `NULL` organization_id, or handle tenant-specific copies upon signup._
- **1.4. Create Indexes:** Add database indexes on Foreign Key columns (`organization_id`, `order_id`, `item_id`, `stage_id`, etc.) and frequently queried columns (`items.current_stage_id`, `items.sku`).

**2. Multi-Tenancy Setup (RLS):**

- **2.1. Create Helper Function (SQL):** Define a reusable SQL function to get the `organization_id` associated with the currently authenticated user.
  ```sql
  CREATE OR REPLACE FUNCTION public.get_my_organization_id()
  RETURNS uuid
  LANGUAGE sql STABLE -- Or SECURITY DEFINER if reading claims directly
  AS $$
    SELECT organization_id
    FROM public.profiles
    WHERE id = auth.uid(); -- Assumes 'profiles' table links auth.uid() to org_id
  $$;
  ```
  _(Adjust function body based on exact profile/claims setup)_.
- **2.2. Apply RLS Policies:** For _every_ table created in step 1 (except maybe global defaults), implement RLS policies:
  - Enable RLS: `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`
  - Create SELECT Policy: `CREATE POLICY "Allow SELECT based on organization" ON public.<table_name> FOR SELECT USING (organization_id = public.get_my_organization_id());`
  - Create INSERT Policy: `CREATE POLICY "Allow INSERT based on organization" ON public.<table_name> FOR INSERT WITH CHECK (organization_id = public.get_my_organization_id());`
  - Create UPDATE Policy: `CREATE POLICY "Allow UPDATE based on organization" ON public.<table_name> FOR UPDATE USING (organization_id = public.get_my_organization_id()) WITH CHECK (organization_id = public.get_my_organization_id());`
  - Create DELETE Policy: `CREATE POLICY "Allow DELETE based on organization" ON public.<table_name> FOR DELETE USING (organization_id = public.get_my_organization_id());`
- **2.3. Test RLS (Basic):** Manually insert data for two different hypothetical organizations and verify (using SQL editor with `SET role authenticator; SELECT set_config('request.jwt.claims', '{"sub":"<user_id_org_1>", "role":"authenticated"}', true);`) that queries only return data for the correct organization.

**3. Backend Logic (Workflow Fetching):**

- **3.1. Install Dependencies:** `npm install @tanstack/react-query` (if not already installed).
- **3.2. Create API Route/Server Action:**
  - Define logic (e.g., in `src/lib/queries/workflow.ts` or directly in a server component/API route) to fetch workflow stages and sub-stages.
  - Use the Supabase server client (`createServerComponentClient` or equivalent).
  - Query `workflow_stages` and `workflow_sub_stages`.
  - Filter by the user's `organization_id` OR fetch `is_default=true` records if implementing tenant-specific copies later.
  - Order by `sequence_order`.
  - Structure the result hierarchically (e.g., `Array<{ stage: Stage; subStages: SubStage[] }>`).
- **3.3. Implement Data Fetching Hook (Optional but Recommended):**
  - Create a hook `src/hooks/queries/use-workflow.ts` using TanStack Query (`useQuery`).
  - Define a query key (e.g., `['workflow', organizationId]`).
  - Call the fetching logic from step 3.2 within the query function.

**4. Frontend Workflow Display (Sidebar):**

- **4.1. Enhance `Sidebar` Component:** (`src/components/layout/sidebar.tsx`).
- **4.2. Fetch Workflow Data:**
  - Use the `useWorkflow` hook (if created) or fetch data directly (Server Component or Client Component with `useEffect`/`useQuery`).
- **4.3. Dynamic Rendering:**
  - Map over the fetched structured workflow data.
  - Render main stages.
  - Use Shadcn `Collapsible` component for stages that have sub-stages.
  - Render sub-stages within the collapsible content.
- **4.4. Display Counts:** Show a static `(0)` next to each stage/sub-stage name for now.
- **4.5. Handle Loading/Error States:** Display loading indicators (e.g., skeletons) or error messages based on the query state.
- **4.6. Handle Selection:** Implement basic state management (e.g., `useState` in the parent layout) to track which stage/sub-stage is currently selected when clicked in the sidebar. Pass the selected stage info to the main content area.

**5. Main Content Area Placeholder:**

- **5.1. Create Placeholder Component:** `src/components/items/item-list-placeholder.tsx` (or similar).
- **5.2. Conditional Rendering:** In the main application layout (`src/app/(app)/layout.tsx` or page), use the selected stage state from the sidebar to display the placeholder component, showing the name of the selected stage (e.g., "Items in Manufacturing - Step 1 will appear here.").

---

**Phase 1 Acceptance Criteria:**

- All defined database tables exist in Supabase with correct columns, types, PKs, FKs, and basic indexes.
- Default workflow stages/sub-stages are populated.
- RLS policies are applied to all tenant-specific tables and basic testing confirms data isolation.
- Backend logic successfully fetches the (default) workflow structure for the logged-in user's organization.
- The UI Sidebar dynamically renders the fetched stages and sub-stages, including collapsible sections.
- Clicking a stage/sub-stage in the sidebar updates the main content area to show a placeholder indicating the selected stage.
- Loading and error states for workflow fetching are handled gracefully in the UI.
