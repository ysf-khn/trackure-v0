# Trackure V1 - Updated Total Implementation Plan

_(Context: Phase 0 Completed; Phase 1 In Progress)_

---

## Phase 1: Core Data Structures & Workflow Display (In Progress -> Completion)

- **Goal:** Finalize database schema (simplified QC logic), implement RLS, seed defaults, implement backend logic for fetching dynamic workflow structure, and display this structure dynamically in the UI Sidebar.
- **Key Remaining Tasks:** Finalize schema implementation (removing complex status fields), seed default workflow data, implement and test Supabase RLS policies, build backend logic/API for fetching workflow structure, dynamically render the fetched workflow in the Sidebar UI, link Sidebar selection to main content area placeholder.

---

## Phase 2: Core Tracking & Forward Movement (Documentation)

- **Goal:** Enable users (Owner/Subs) to create Orders, add Items (with implicit master creation/autocomplete), and _document_ the forward progression of items through the defined workflow stages, logging history.
- **Tasks:**
  - Implement UI Forms (React Hook Form + Zod) for Order creation.
  - Implement UI and logic for adding Items to Orders, including SKU-based autocomplete and implicit creation of `item_master` records. Allow overriding instance details.
  - Develop the main Table View (Shadcn Table) to display items filtered by the selected stage/sub-stage from the Sidebar.
  - Implement the **"Move Forward"** action:
    - UI element (button/menu) on item selection.
    - Backend logic updates the item's `current_stage_id`/`sub_stage_id` to the next stage in the configured sequence.
    - Log the movement (stage exit/entry) in `item_history`.
    - Update UI counts/views (real-time/refetch).
  - Implement a view/modal to display the `item_history` for a selected item.
  - Implement basic "Time in Stage" display based on `item_history` timestamps.
  - Enforce Role-Based Access Control (RBAC) ensuring only authorized users can move items.

---

## Phase 3: Rework Recording & Remarks

- **Goal:** Allow users (Owner/Subs) to _document_ rework instances by selecting items, sending them back to a previous stage in the system, and recording the reason. Implement the remarks system.
- **Tasks:**
  - Implement the **"Send Back (Record Rework)"** action:
    - UI element (button/menu) on item selection.
    - Modal prompting user to select the target _rework_ stage/sub-stage (from valid previous steps) and input a reason.
    - Backend logic updates the item's `current_stage_id`/`sub_stage_id` to the selected rework stage.
    - Log the rework movement in `item_history`, storing the `rework_reason`.
    - Update UI counts/views.
  - Implement the Remarks feature:
    - UI for adding remarks (modal/panel associated with an item).
    - Backend logic to save remarks linked to the item (and potentially specific history entry).
    - Display remarks chronologically in the item detail/history view.
  - Enforce RBAC for rework actions.

---

## Phase 4: Workflow Customization

- **Goal:** Enable 'Owner' role users to customize the workflow structure (stages and sub-stages).
- **Tasks:**
  - Create UI Settings section (Owner only) for managing workflow stages and sub-stages.
  - Implement backend API/logic for CRUD (Create, Read, Update, Delete) and reordering operations on `workflow_stages` and `workflow_sub_stages`.
  - Update the Sidebar navigation to dynamically display the customized workflow structure.
  - Modify the backend logic for "Move Forward" and "Send Back (Record Rework)" actions to correctly determine the next/previous stages based on the _custom_ workflow sequence.
  - Define and implement behavior for deleting stages/sub-stages containing active items.

---

## Phase 5: Supporting Modules

- **Goal:** Implement Packaging Logistics (material definition, user-defined reminders via Resend), PDF generation (Vouchers/Invoices - Owner only), and basic Payment Status recording (Owner only).
- **Tasks:**
  - **Packaging:** UI for defining materials per order; UI for Owner to set reminder trigger stage; Backend scheduled task/logic to check triggers; Resend API integration for email reminders; Basic in-app notifications.
  - **PDF Generation:** Integrate PDF library; Backend logic to fetch data; Basic templates for Vouchers & Invoices; Download UI actions (Owner only).
  - **Payment Status:** Add UI element (Owner only) to manually set internal payment status (Lent, Credit, Paid) on orders; Enforce visibility/edit restrictions via RBAC.

---

## Phase 6: Reporting, Images & Polish

- **Goal:** Implement basic reporting (counts, CSV export), image upload/viewing functionality, and perform final UI/UX refinement.
- **Tasks:**
  - **Reporting:** Implement dashboard widget displaying item counts per stage; Implement basic CSV export for filtered item lists (Owner only).
  - **Images:** Implement client-side image optimization; Integrate Supabase Storage; UI for uploading/associating images with items/stages; UI for viewing associated images; Implement Storage RLS.
  - **UI/UX Polish:** Refine layouts, transitions, typography, spacing based on dark theme. Ensure consistency and usability across all features. Perform accessibility checks (contrast, keyboard nav, focus states).

---

## Phase 7: Testing, Deployment & Documentation

- **Goal:** Conduct final testing, prepare for and execute production deployment, and create basic user documentation.
- **Tasks:**
  - **Testing:** Perform thorough end-to-end manual testing of all core user flows (forward movement documentation, rework recording, workflow customization, permissions). Write/run unit/integration tests for critical backend logic.
  - **Security Review:** Final check of RLS policies, RBAC enforcement, input validation.
  - **Bug Fixing:** Address all critical/major bugs found during testing.
  - **Production Setup:** Configure production Supabase project and Vercel deployment settings (environment variables, etc.).
  - **Documentation:** Create initial user guides covering essential features for Owners and Workers.
  - **Deployment:** Deploy Trackure V1 to the production environment.

---

## Cross-Cutting Activities (Ongoing through all phases)

- **Unit & Integration Testing:** Continuously write tests for new logic.
- **Code Reviews:** Maintain code quality and consistency.
- **Dependency Updates:** Regularly check and update dependencies.
- **Error Monitoring Setup:** Integrate and configure error tracking (e.g., Sentry).
- **Feedback Incorporation:** Address feedback if available from early testing/reviews.
