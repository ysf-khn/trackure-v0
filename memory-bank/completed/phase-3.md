# Trackure V1 - Implementation Plan: Phase 3 Detailed Tasks

**Phase Goal:** Allow users (Owner/Subs) to _document_ rework instances by selecting items, sending them back to a previous stage in the system, and recording the reason. Implement the remarks system. Enforce Role-Based Access Control (RBAC) for these actions.

_(Prerequisites: Phase 2 completed - Users can create orders/items, move items forward, view history. Core UI components like Tables, Modals are established)._

---

## Tasks Breakdown:

**1. "Send Back (Record Rework)" Action:**

- **1.1. UI Trigger:**
  - **Action:** Add a "Send Back for Rework" button (enabled when items are selected) and/or an action item within the row's `DropdownMenu` in the `ItemListTable` component (`components/items/item-list-table.tsx`).
  - **Action:** Conditionally render this UI element based on user role (accessible only to 'Owner' as per current PRD, unless Worker permission is granted).
- **1.2. Rework Modal UI:**
  - **Action:** Create a new component for the Rework Modal (`components/items/rework-modal.tsx`) using Shadcn `Dialog`.
  - **Action:** Include the following fields within the modal form (using React Hook Form + Zod):
    - `Target Stage/Sub-stage`: A `Select` component (Shadcn `Select`) to choose the destination rework stage.
    - `Reason for Rework`: A `Textarea` component (Shadcn `Textarea`) for the detailed reason.
    - (Display the selected Item IDs for confirmation).
- **1.3. Populate Target Stage Dropdown:**
  - **Action:** When the Rework Modal opens, fetch the list of valid _previous_ stages/sub-stages for the selected item(s).
  - **Action:** Create a backend API route (e.g., `api/workflows/valid-rework-targets?currentItemStageId=...¤tItemSubStageId=...`) that takes the current stage/sub-stage ID.
  - **Action:** This API route queries the organization's `workflow_stages` and `workflow_sub_stages` based on `organization_id`, filtering for stages/sub-stages with a `sequence_order` _less than_ the current stage/sub-stage's sequence order. Return `id` and `name`.
  - **Action:** Use `useQuery` in the Rework Modal to fetch these valid targets and populate the `Select` component.
- **1.4. Backend API for Rework Action:**
  - **Action:** Create a new API route (e.g., `app/api/items/move/rework/route.ts` - handling POST).
  - **Action:** Expect an array of `item_id`s, the target `rework_stage_id`, target `rework_sub_stage_id` (nullable), and `rework_reason` text in the request body. Validate input using Zod.
  - **Action:** Verify user authentication, get `organization_id`, and perform RBAC check (ensure user role is 'Owner').
  - **Action:** For each `item_id`:
    - _(Optional but recommended: Fetch current stage/sub-stage to validate against history)._
    - Validate that the selected target rework stage/sub-stage is a valid previous step (re-check sequence order or trust frontend fetch if preferred, but backend validation is safer).
    - `UPDATE` the `items` record: Set `current_stage_id` to `rework_stage_id`, set `current_sub_stage_id` to `rework_sub_stage_id`.
    - Find the latest `item_history` record for this item and update its `exited_at` timestamp.
    - `INSERT` a new `item_history` record for the entry into the _rework_ stage (set `entered_at`, `user_id`, `rework_reason` from input, `action_taken='Sent Back'`).
    - _(Wrap DB operations in a transaction if possible)_.
  - **Action:** _(Optional: Automatically create a `remarks` entry from the `rework_reason` text? Requires linking Remarks API logic or doing it here)_.
  - **Action:** Implement robust error handling (e.g., invalid target stage, DB errors). Return appropriate success/error response.
- **1.5. Frontend API Integration (Rework Modal):**
  - **Action:** Use `useMutation` within the Rework Modal's form submission handler to call the rework API route.
  - **Action:** Pass selected `item_id`s, chosen target stage/sub-stage IDs, and reason.
  - **Action:** Handle loading (disable submit button) / success (close modal, show notification) / error (display error message) states.
  - **Action:** On success, trigger refetch of relevant item lists (invalidate TanStack Query keys for the stages involved) and sidebar counts.

**2. Remarks Feature:**

- **2.1. UI Trigger:**
  - **Action:** Add an "Add Remark" button/icon in the `ItemListTable` row actions or within an Item Detail view/modal. This should be available to both 'Owner' and 'Worker' roles.
- **2.2. Add Remark Modal/Panel UI:**
  - **Action:** Create a simple component (`components/items/add-remark-modal.tsx`?) using Shadcn `Dialog` or `Sheet`.
  - **Action:** Include a `Textarea` for the remark content and a Submit button. Pass the relevant `item_id`.
- **2.3. Backend API for Adding Remarks:**
  - **Action:** Create an API route (e.g., `app/api/items/[itemId]/remarks/route.ts` - handling POST).
  - **Action:** Validate request body (remark text) using Zod. Extract `itemId` from the route parameters.
  - **Action:** Verify user authentication and get `user_id`, `organization_id`. (RBAC: Allow both Owner and Worker).
  - **Action:** `INSERT` into the `remarks` table, providing `item_id`, `user_id`, `text`, `timestamp` (use DB `NOW()`), and `organization_id`.
  - **Action:** Handle errors and return success/error response.
- **2.4. Frontend API Integration (Add Remark Modal):**
  - **Action:** Use `useMutation` in the Add Remark modal to call the API.
  - **Action:** Handle loading/success/error states. Clear textarea and potentially close modal on success.
  - **Action:** On success, trigger refetch of item history/remarks data if it's currently being viewed.
- **2.5. Display Remarks:**
  - **Action:** Enhance the Item History view/modal (created in Phase 2) or create a dedicated "Remarks" tab/section within an item detail view.
  - **Action:** Create a query/hook (`useQuery`) to fetch records from the `remarks` table, filtered by `item_id` and ordered by `timestamp` descending. Join with `profiles` table to display user name.
  - **Action:** Render the fetched remarks clearly, showing text, user, and timestamp.

**3. Role-Based Access Control (RBAC) Enforcement:**

- **3.1. Backend Checks:**
  - **Action:** Double-check and ensure the explicit role check (`if (user.role !== 'Owner') return 403...`) is implemented in the `/api/items/move/rework/` route handler.
  - **Action:** Confirm the `/api/items/[itemId]/remarks/` route allows _both_ 'Owner' and 'Worker' roles (or adjust if requirements change).
- **3.2. Frontend UI Conditions:**
  - **Action:** Ensure the "Send Back for Rework" UI elements are conditionally rendered based on the user's role (fetched during authentication/session management). The "Add Remark" element should be visible to both roles.

---

**Phase 3 Acceptance Criteria:**

- Authorized users ('Owner') can select items and trigger the "Send Back (Record Rework)" action.
- The Rework Modal correctly fetches and displays valid previous stages/sub-stages.
- Submitting the Rework Modal successfully updates the selected items' location in the database to the chosen rework stage.
- A corresponding `item_history` record is created, logging the rework action and reason.
- Users ('Owner' and 'Worker') can trigger the "Add Remark" action.
- The Add Remark modal allows text entry and successfully saves remarks linked to the correct item and user in the database.
- Remarks associated with an item are displayed chronologically in the UI (e.g., within the Item History view).
- RBAC is enforced correctly on the backend for both rework and remark actions.
- Frontend UI elements for rework are conditionally rendered based on user role.
- Relevant UI views (item lists, sidebar counts) update correctly after rework actions.
