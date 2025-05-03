# Trackure V1 - Implementation Plan: Phase 1 Detailed Tasks (Updated)

**Phase Goal:** Finalize database schema (simplified QC logic), implement RLS, seed defaults, implement backend logic for fetching dynamic workflow structure, and display this structure dynamically in the UI Sidebar.
_(Context: Phase 0 completed. Steps 1.1 & 1.2 initiated, requiring finalization based on simplified workflow.)_

---

## Tasks Breakdown:

**1. Database Schema Design & Implementation (Supabase/PostgreSQL) - _Finalization_**

- **1.1. Review & Finalize Table Design:**
  - **Action:** Revisit the schemas defined for `organizations`, `profiles`, `workflow_stages`, `workflow_sub_stages`, `orders`, `items`, `item_history`, `remarks`, `item_master`.
  - **Confirm Removal:** Explicitly **ensure** any previously planned `item_status` column intended for complex QC states (like `'Awaiting QC'`) is **removed** from the `items` table schema. The primary status is defined by `current_stage_id`/`sub_stage_id`.
  - **Confirm History:** Verify `item_history` includes `rework_reason (text, nullable)` and consider adding `action_taken (text, nullable)`.
  - **Confirm Master:** Verify `item_master` uses `(sku, organization_id)` as Composite Primary Key.
- **1.2. Implement/Verify Schema Changes:**
  - **Action:** If schema modifications were needed in 1.1 (like removing `item_status`), update the Supabase SQL Editor scripts or local migration files (`supabase/migrations`).
  - **Action:** Apply/re-apply migrations or SQL changes to ensure the database reflects the finalized schema.
  - **Action:** Double-check all PKs, FKs, `NOT NULL` constraints, and default values are correct.
- **1.3. Seed Default Workflow:**
  - **Action:** Create and run an SQL script (or use Supabase dashboard) to insert the default `workflow_stages` and `workflow_sub_stages` records (e.g., Order Intake, Manufacturing -> Sub-stages, etc.).
  - Mark these records with `is_default = true`. Set `organization_id` to `NULL` (or chosen strategy for defaults). Set `sequence_order` correctly.
- **1.4. Create/Verify Indexes:**
  - **Action:** Create necessary database indexes using Supabase SQL Editor (`CREATE INDEX...`). Focus on FK columns (`organization_id`, `order_id`, `item_id`, `stage_id`, etc.) and frequently queried columns (`items.current_stage_id`, `items.sku`). Ensure no index exists for the removed `item_status` column.

**2. Multi-Tenancy Setup (RLS):**

- **2.1. Create Helper Function (SQL):**
  - **Action:** Implement the `public.get_my_organization_id()` SQL function to retrieve the org ID for the current user from the `profiles` table. Test it.
- **2.2. Apply RLS Policies:**
  - **Action:** For _every_ relevant tenant-specific table (finalized in 1.1/1.2), enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
  - **Action:** Create the standard `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies using `organization_id = public.get_my_organization_id()`.
- **2.3. Test RLS (Basic):**
  - **Action:** Perform manual SQL checks (e.g., using `SET role`, `set_config` in SQL Editor) to verify data isolation works as expected for different users/organizations.

**3. Backend Logic (Workflow Fetching):**

- **3.1. Install Dependencies:** Verify `@tanstack/react-query` is installed.
- **3.2. Create API Route/Server Action/Query Logic:**
  - **Action:** Implement backend logic (e.g., in `src/lib/queries/workflow.ts`) using Supabase server client.
  - **Action:** Fetch `workflow_stages` and `workflow_sub_stages`, filtering by user's org ID (or `is_default=true`), ordering by `sequence_order`, and structuring hierarchically.
- **3.3. Implement Data Fetching Hook (Optional but Recommended):**
  - **Action:** Create `src/hooks/queries/use-workflow.ts` using `useQuery` to wrap the fetching logic. Define query key. Handle loading/error states.

**4. Frontend Workflow Display (Sidebar):**

- **4.1. Enhance `Sidebar` Component:** (`src/components/layout/sidebar.tsx`).
- **4.2. Fetch Workflow Data:**
  - **Action:** Integrate the `useWorkflow` hook or direct fetching logic into the component rendering the sidebar.
- **4.3. Dynamic Rendering:**
  - **Action:** Implement JSX to map over fetched data, render stages/sub-stages dynamically, using Shadcn `Collapsible` for nesting.
- **4.4. Display Counts (Placeholder):**
  - **Action:** Temporarily display static `(0)` next to stage names.
- **4.5. Handle Loading/Error States:**
  - **Action:** Implement UI feedback (spinners, skeletons, error messages) based on the workflow fetch status.
- **4.6. Handle Selection:**
  - **Action:** Implement client-side state (e.g., `useState` in layout) to track the currently selected stage/sub-stage ID based on user clicks in the sidebar.

**5. Main Content Area Placeholder:**

- **5.1. Create Placeholder Component:** (`src/components/items/item-list-placeholder.tsx` or similar).
- **5.2. Conditional Rendering:**
  - **Action:** In the main content area, receive the selected stage/sub-stage ID from the layout state.
  - **Action:** Display the placeholder component, dynamically showing the name of the selected stage/sub-stage (e.g., fetch stage name based on ID or pass it down).

---

**Phase 1 Acceptance Criteria:**

- Database schema finalized (simplified QC logic), implemented, and default workflow seeded.
- RLS policies applied to tenant-specific tables and basic data isolation verified.
- Backend logic correctly fetches the dynamic workflow structure based on user's org or defaults.
- UI Sidebar dynamically renders the correct workflow structure, handling nesting.
- Sidebar correctly handles loading/error states during workflow fetch.
- Clicking a stage/sub-stage in the sidebar updates local state.
- Main content area displays a placeholder reflecting the currently selected stage/sub-stage name.
