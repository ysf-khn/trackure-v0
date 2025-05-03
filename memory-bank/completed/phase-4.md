# Trackure V1 - Implementation Plan: Phase 4 Detailed Tasks

**Phase Goal:** Enable 'Owner' role users to customize the workflow structure (stages and sub-stages), including creating, editing, deleting, and reordering them. Update core movement logic and UI to reflect these customizations.

_(Prerequisites: Phase 3 completed - Users can move items forward, record rework, and use remarks. Core UI components and data fetching patterns established)._

---

## Tasks Breakdown:

**1. Settings UI Foundation:**

- **1.1. Create Settings Area:**
  - **Action:** Create a new protected route group and page for settings, accessible only to 'Owner' users (e.g., `app/(app)/settings/page.tsx`). Use middleware or page-level checks for role enforcement.
  - **Action:** Design the layout for the settings area (e.g., using Shadcn `Tabs` for different setting categories). Create a "Workflow" tab.
- **1.2. Data Fetching for Workflow Structure:**
  - **Action:** Create/modify a hook/query (`useWorkflowStructure`?) using TanStack Query to fetch _all_ `workflow_stages` and `workflow_sub_stages` belonging to the user's `organization_id`, ordered by `sequence_order`. Ensure sub-stages are nested under their parent stage in the returned data.
  - **Action:** Handle loading/error states for this fetch.

**2. Display Current Workflow Structure:**

- **2.1. Workflow Display Component:** (`components/settings/workflow-editor.tsx` or similar)
  - **Action:** Use the query from 1.2 to get the current workflow structure.
  - **Action:** Render the stages and their nested sub-stages in a clear list or tree format. Display `name` and potentially `sequence_order`.
  - **Action:** Include buttons/icons next to each stage/sub-stage for "Edit", "Delete", and potentially "Add Sub-stage" (for stages). Add an "Add Stage" button at the main level.

**3. CRUD Operations - Stages:**

- **3.1. Add Stage:**
  - **UI:** Trigger a Modal (Shadcn `Dialog`) with fields for `name` and `sequence_order` (show calculated next available order automatically). Use React Hook Form + Zod.
  - **API:** Create `POST /api/settings/workflow/stages` route. Validate input. Verify 'Owner' role. `INSERT` new stage into `workflow_stages` with correct `organization_id` and calculated `sequence_order`.
  - **Integration:** Use `useMutation` in the modal, handle state, refetch workflow structure on success.
- **3.2. Edit Stage:**
  - **UI:** Trigger Modal pre-filled with current `name`. Allow editing `name`. (Editing `sequence_order` is handled by reordering). Use RHF+Zod.
  - **API:** Create `PUT /api/settings/workflow/stages/[stageId]` route. Validate input. Verify 'Owner' role and ownership of the stage (`organization_id`). `UPDATE` stage name in DB.
  - **Integration:** `useMutation`, handle state, refetch workflow on success.
- **3.3. Delete Stage:**
  - **UI:** Trigger a confirmation dialog (Shadcn `AlertDialog`) explaining the action.
  - **API:** Create `DELETE /api/settings/workflow/stages/[stageId]` route. Verify 'Owner' role and ownership.
  - **Deletion Logic (Crucial):**
    - _Check for Items:_ Before deleting, query the `items` table to see if any items within the user's `organization_id` have `current_stage_id` matching the stage being deleted.
    - _Prevent if Items Exist (V1 Strategy):_ If items exist, return an error (e.g., 409 Conflict) indicating the stage cannot be deleted while in use (items are present in it). Do not delete.
    - _Delete if Empty:_ If no items are in the stage, proceed to `DELETE` the stage record (handle FK constraints - potentially delete associated sub-stages first or use `ON DELETE CASCADE` carefully).
  - **Integration:** `useMutation`, handle state (show error if deletion prevented), refetch workflow on successful deletion.
- **3.4. Refresh sidebar workflow stages after any changes in settings.**

**4. CRUD Operations - Sub-stages:**

- **4.1. Add Sub-stage:**
  - **UI:** Trigger Modal from a specific Stage context. Fields for `name` and `sequence_order` (calculate next). Pass the parent `stage_id`. Use RHF+Zod.
  - **API:** Create `POST /api/settings/workflow/stages/[stageId]/sub-stages` route. Validate. Verify 'Owner' and ownership of parent stage. `INSERT` new sub-stage into `workflow_sub_stages` with correct `organization_id`, `stage_id`, and `sequence_order`.
  - **Integration:** `useMutation`, handle state, refetch workflow.
- **4.2. Edit Sub-stage:**
  - **UI:** Trigger Modal pre-filled with current `name`. Allow editing `name`. Use RHF+Zod.
  - **API:** Create `PUT /api/settings/workflow/sub-stages/[subStageId]` route. Validate. Verify 'Owner' and ownership. `UPDATE` sub-stage name.
  - **Integration:** `useMutation`, handle state, refetch workflow.
- **4.3. Delete Sub-stage:**
  - **UI:** Trigger confirmation (`AlertDialog`).
  - **API:** Create `DELETE /api/settings/workflow/sub-stages/[subStageId]` route. Verify 'Owner' and ownership.
  - **Deletion Logic:** Similar to stages - check if any items have the `current_sub_stage_id`. Prevent deletion if items exist (V1 Strategy). Delete if empty.
  - **Integration:** `useMutation`, handle state, refetch workflow.

**5. Reordering Logic (Stages & Sub-stages):**

- **5.1. UI for Reordering (Simple V1):**
  - **Action:** Add "Move Up" / "Move Down" buttons next to each stage and sub-stage (within its parent stage group) in the `workflow-editor.tsx` component. Disable buttons appropriately (e.g., "Move Up" for the first item).
- **5.2. Backend API for Reordering:**
  - **Action:** Create API routes (e.g., `POST /api/settings/workflow/stages/reorder`, `POST /api/settings/workflow/sub-stages/reorder`).
  - **Action:** Expect parameters like `itemId` (stage or sub-stage ID) and `direction` ('up' or 'down').
  - **Action:** Backend logic:
    - Verify 'Owner' role and ownership.
    - Fetch the item to be moved and its sibling(s) based on current `sequence_order` (filtering by `organization_id` and `stage_id` for sub-stages).
    - Determine the sibling to swap sequence numbers with based on the direction.
    - Perform the `UPDATE` operations (swap `sequence_order` values) within a database transaction.
- **5.3. Frontend Integration:**
  - **Action:** Attach `useMutation` calls to the "Move Up"/"Move Down" buttons, passing necessary IDs and direction.
  - **Action:** Handle loading state. On success, refetch the entire workflow structure to reflect the new order. (Optimistic UI updates are possible but add complexity).

**6. Update Core Logic ("Move Forward" & "Send Back"):**

- **6.1. Modify Backend Logic:**
  - **Action:** In the API handlers for `/api/items/move/forward/` and `/api/items/move/rework/`:
    - **Crucially:** Before determining the next/previous step, **fetch the current, potentially customized, workflow structure** (`workflow_stages` and `workflow_sub_stages`) filtered by the user's `organization_id` and ordered by `sequence_order`.
    - **Action:** Update the logic that calculates the next/previous `stage_id`/`sub_stage_id` to use this fetched custom sequence, instead of relying on default assumptions or IDs. Handle transitions between sub-stages and main stages correctly based on the fetched order.

**7. Update Sidebar Display:**
Need to do this when gemini comes back on

- **7.1. Use Updated Fetch Logic:**
  - **Action:** Ensure the `Sidebar` component uses the same updated workflow fetching logic (`useWorkflowStructure` or similar from step 1.2) that retrieves the _customized_ order for the current organization.
  - **Action:** The dynamic rendering logic should already work, as it just maps over the fetched data.

**8. Role-Based Access Control (RBAC):**

- **8.1. Backend Enforcement:**
  - **Action:** Ensure _all_ new API routes created in this phase (`/api/settings/...`) rigorously check for the 'Owner' role before performing any action. Return 403 Forbidden if the user is not an Owner.
- **8.2. Frontend Enforcement:**
  - **Action:** Protect the entire `/settings` route using middleware or page-level checks to prevent Workers from accessing it.

---

**Phase 4 Acceptance Criteria:**

- An 'Owner' user can access a dedicated settings area for workflow management.
- The settings area correctly displays the current workflow structure (stages and sub-stages) for the Owner's organization.
- Owners can successfully add new custom stages and sub-stages.
- Owners can successfully edit the names of existing stages and sub-stages.
- Owners can successfully delete stages/sub-stages, _only if_ no active items currently reside in them. An appropriate error is shown otherwise.
- Owners can successfully reorder stages and sub-stages using UI controls (e.g., Up/Down buttons).
- The main application Sidebar dynamically displays the customized workflow structure after changes are made.
- The "Move Forward" and "Send Back (Record Rework)" actions correctly determine the next/previous steps based on the customized workflow sequence.
- 'Worker' role users cannot access the workflow settings UI or trigger the workflow management API endpoints.
- All operations provide appropriate loading, success, and error feedback to the user.
