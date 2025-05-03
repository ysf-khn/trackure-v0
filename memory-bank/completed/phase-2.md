# Trackure V1 - Implementation Plan: Phase 2 Detailed Tasks

**Phase Goal:** Enable users (Owner/Subs) to create Orders, add Items (with implicit master creation/autocomplete), and _document_ the forward progression of items through the defined workflow stages, logging history.

_(Prerequisites: Phase 1 completed - Database schema finalized, RLS implemented, default workflow seeded, Sidebar dynamically displays workflow)._

---

## Tasks Breakdown:

**1. Order Creation:**

- **1.1. UI for Initiating Order Creation:**
  - **Action:** Add a "Create Order" button in an appropriate location (e.g., main dashboard, dedicated orders page).
- **1.2. Order Creation Form:**
  - **Action:** Create a new route/page for order creation (e.g., `src/app/(app)/orders/new/page.tsx`).
  - **Action:** Build the form using Shadcn components (`Card`, `Input`, `Label`, `Button`).
  - **Action:** Implement form state and validation using React Hook Form + Zod for required fields (e.g., Order Number, Customer Name - based on PRD, make optional if needed).
- **1.3. Backend API for Order Creation:**
  - **Action:** Create a Next.js API Route (e.g., `src/app/api/orders/route.ts` - handling POST).
  - **Action:** Implement request body validation using Zod.
  - **Action:** Verify user authentication and fetch user's `organization_id` and `role`. (RBAC: Decide if Worker can create orders, assume yes for now unless specified otherwise).
  - **Action:** Use Supabase server client to `INSERT` a new record into the `orders` table, including `organization_id` and other validated fields.
  - **Action:** Implement error handling and return appropriate success/error JSON responses.
- **1.4. Frontend API Integration:**
  - **Action:** Use TanStack Query's `useMutation` hook in the Order Creation Form component to handle the POST request to the API route.
  - **Action:** Implement loading states (e.g., disable button, show spinner) and display success/error messages to the user.
  - **Action:** On successful creation, redirect the user to the new order's detail page (to be created) or back to an orders list.

**2. Adding Items to Order (Implicit Master Handling):**

- **2.1. UI Location:** Determine where items are added (e.g., within the Order Detail Page created in 1.4, or as part of a multi-step order creation). Designate an "Add Item" section/button.
- **2.2. Add Item Form:**
  - **Action:** Create a form (potentially within a Modal or inline section) using Shadcn components.
  - **Action:** Include fields for `SKU` (primary identifier) and all `instance_details` (Weight, Size, Box Size, etc. - defined in PRD).
- **2.3. SKU Autocomplete:**
  - **Action:** Implement an input component for SKU that triggers a search on change (use debouncing like `use-debounce`).
  - **Action:** Create a backend API route (e.g., `/api/item-master/search?q=...`) that queries the `item_master` table based on the SKU and `organization_id`, returning potential matches.
  - **Action:** Use a library like Shadcn `Combobox` or build custom dropdown logic to display autocomplete suggestions fetched via `useQuery`.
- **2.4. Autocomplete Selection Logic:**
  - **Action:** On selecting an item from autocomplete, use its `master_details` (fetched along with the suggestion or via a separate query) to pre-fill the form's `instance_details` fields.
- **2.5. Manual Entry & Overrides:**
  - **Action:** Allow users to manually fill/override the `instance_details` even if an item was selected via autocomplete.
- **2.6. Backend API for Adding Item:**
  - **Action:** Create API route (e.g., `src/app/api/orders/[orderId]/items/route.ts` - handling POST).
  - **Action:** Validate input (SKU, instance details) using Zod.
  - **Action:** Verify auth and get `organization_id`.
  - **Action:** Query `item_master` to check if SKU exists for the org.
    - If **not**, `INSERT` into `item_master` using the provided details as `master_details`.
  - **Action:** Determine the _first_ stage/sub-stage ID from the organization's workflow configuration.
  - **Action:** `INSERT` into the `items` table (linking to `order_id`, setting `sku`, `instance_details`, initial `current_stage_id`/`sub_stage_id`, `organization_id`).
  - **Action:** Insert the _initial_ record into `item_history` for this item entering the first stage (set `entered_at`, `user_id`).
  - **Action:** Implement robust error handling.
- **2.7. Frontend API Integration:**
  - **Action:** Use `useMutation` in the Add Item form to call the API. Handle loading/success/error states. Reset form on success. Trigger refetch of the order's item list.

**3. Display Items in Stage (Table View):**

- **3.1. Main Content Area Component:** Create/refine the component that displays content based on sidebar selection.
- **3.2. Data Fetching Hook:**
  - **Action:** Create `src/hooks/queries/use-items-in-stage.ts` using `useQuery`.
  - **Action:** Pass the selected `stageId` (and potentially `subStageId`) as part of the query key.
  - **Action:** Fetch function queries the `items` table, filtering by `current_stage_id` (and/or `sub_stage_id`) and the user's `organization_id`. Include necessary item details and potentially the `entered_at` timestamp from the latest relevant `item_history` record for "Time in Stage" calculation.
- **3.3. Item List Table Component:** (`src/components/items/item-list-table.tsx`)
  - **Action:** Use the hook from 3.2 to get data.
  - **Action:** Implement the table using Shadcn `Table`. Define columns (Checkbox for selection, SKU, Key Instance Details, Time in Stage, Action Menu).
  - **Action:** Implement basic pagination if needed.
  - **Action:** Handle loading, error, and empty states gracefully.

**4. "Move Forward" Action (Documentation):**

- **4.1. UI Trigger:**
  - **Action:** Add a "Move Forward" button (enabled when items are selected via checkboxes) or an action item within a row menu (e.g., Shadcn `DropdownMenu`).
- **4.2. Backend API for Moving Forward:**
  - **Action:** Create API route (e.g., `src/app/api/items/move/forward/route.ts` - handling POST).
  - **Action:** Expect an array of `item_id`s in the request body. Validate input.
  - **Action:** Verify auth, get `organization_id`, and check user `role` (RBAC: ensure Owner/Worker can perform this).
  - **Action:** For each `item_id`:
    - Fetch the item's current `current_stage_id`, `current_sub_stage_id`.
    - Fetch the organization's workflow configuration (stages/sub-stages with `sequence_order`).
    - Determine the **next** `stage_id`/`sub_stage_id` based on the current location and sequence order (handle moving between sub-stages, end of main stage to next main stage, stages with no sub-stages).
    - `UPDATE` the `items` record with the new stage/sub-stage IDs.
    - Find the latest `item_history` record for this item and update its `exited_at` timestamp.
    - `INSERT` a new `item_history` record for the entry into the _new_ stage (set `entered_at`, `user_id`, `action_taken='Moved Forward'`).
    - _(Wrap these DB operations in a transaction if possible for atomicity)_.
  - **Action:** Implement error handling for invalid moves or database errors.
- **4.3. Frontend API Integration:**
  - **Action:** Use `useMutation` to call the "Move Forward" API. Pass selected `item_id`s.
  - **Action:** Handle loading/success/error states.
  - **Action:** On success, trigger refetch of the current stage's item list (via TanStack Query invalidation) and potentially update sidebar counts.

**5. Display Item History:**

- **5.1. UI Trigger:** Add a "View History" button/link within the item table row or an item detail view.
- **5.2. History Modal/Panel:**
  - **Action:** Create a component using Shadcn `Dialog` or `Sheet`.
- **5.3. Data Fetching:**
  - **Action:** Create a hook/query (`useQuery`) to fetch `item_history` records filtered by the specific `item_id`, ordered by `entered_at` descending. Join with `users` and `stages`/`sub_stages` tables to get names.
- **5.4. Display Logic:**
  - **Action:** Render the fetched history records in a clear list or timeline format within the modal/panel, showing Stage, Sub-stage, Entered, Exited, User, Action, Rework Reason (if applicable).

**6. Time in Stage Display:**

- **6.1. Fetch Entry Time:** Ensure the query fetching items for the table view (Step 3.2) also retrieves the `entered_at` timestamp for the item's _current_ stage from the latest relevant `item_history` record.
- **6.2. Frontend Calculation & Display:**
  - **Action:** In the `ItemListTable` component, calculate the duration between the `entered_at` timestamp and the current time.
  - **Action:** Use `date-fns` or `Day.js` library (`formatDistanceToNow` or similar) to display this duration in a human-readable format (e.g., "2 hours", "3 days").

**7. Role-Based Access Control (RBAC):**

- **7.1. Backend Enforcement:**
  - **Action:** In all relevant API routes (Order Create, Item Add, Move Forward), add explicit checks for the user's role retrieved from their profile/session data. Ensure the role (`Owner` or `Worker`) has permission for the action. Return 403 Forbidden errors if not authorized.
- **7.2. Frontend UI Conditional Rendering:**
  - **Action:** Conditionally render UI elements (e.g., buttons) based on the user's role where appropriate, although backend checks are the primary security measure.

---

**Phase 2 Acceptance Criteria:**

- Users can successfully create new Orders.
- Users can add Items to Orders, with SKU autocomplete working and implicit `item_master` creation functioning. Instance details can be overridden.
- The main content area displays a table of items filtered correctly based on the stage/sub-stage selected in the sidebar.
- Users (with appropriate roles) can select one or more items and successfully execute the "Move Forward" action, updating the item's location and logging history.
- The system correctly determines the next stage/sub-stage in the sequence.
- A basic view showing the historical movements of an item is available.
- The time an item has spent in its current stage is calculated and displayed.
- Basic RBAC checks are implemented on the backend to control who can perform core actions.
