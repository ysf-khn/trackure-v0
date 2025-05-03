# Trackure V1 - Implementation Plan

## Guiding Principles

*   **Foundation First:** Core setup, auth, structure before complex features.
*   **Core Workflow is Key:** Prioritize item tracking, stages, and rework.
*   **Iterative Development:** Build, test, refine incrementally (Agile sprints suggested).
*   **Test Continuously:** Integrate unit, integration, and E2E testing early.
*   **Security Mindset:** Implement RLS and RBAC alongside features.

---

## Phase 0: Foundation & Setup (Sprint 0/1)

*   **Goal:** Set up project environment, basic authentication, core layout, theme.
*   **Tasks:**
    *   Initialize Next.js project (App Router).
    *   Set up Supabase project (DB, Auth, Storage).
    *   Integrate Supabase Auth (Email/Password signup, login, logout).
    *   Set up Tailwind CSS, `tailwindcss-animate`.
    *   Configure dark theme colors & typography in `tailwind.config.js` / `globals.css`.
    *   Install & configure Shadcn/ui.
    *   Create basic application layout (Sidebar + Main Content Area).
    *   Set up basic project structure (folders).
    *   Implement basic routing (login, dashboard placeholder).
    *   Set up Git repository & basic CI/CD (e.g., Vercel staging).

---

## Phase 1: Core Data Structures & Workflow Display (Sprint 1/2)

*   **Goal:** Define DB schema for core entities, display static default workflow, implement basic RLS.
*   **Tasks:**
    *   Design & implement Supabase/PostgreSQL schemas for:
        *   `organizations`, `users`/`profiles` (with `organization_id`, `role`).
        *   `workflow_stages`, `workflow_sub_stages` (with `organization_id`, `is_default`, linking).
        *   `orders`, `items` (with `organization_id`, linking, status fields).
        *   `item_history` (tracking stage movements, `organization_id`).
        *   `remarks` (linking to item/history, `organization_id`).
        *   `item_master` (for implicit catalog, `organization_id`).
    *   Implement initial Supabase RLS policies based on `organization_id`.
    *   Build backend logic to fetch default workflow stages/sub-stages.
    *   Display fetched stages/sub-stages dynamically in Sidebar component.
    *   Create placeholder view for displaying items in a selected stage.

---

## Phase 2: Core Tracking & Forward Movement (Sprint 2/3)

*   **Goal:** Allow adding orders/items & moving them *forward* through the default workflow, tracking history.
*   **Tasks:**
    *   Implement Forms (React Hook Form + Zod) for creating Orders.
    *   Implement adding Items to orders (incl. implicit item master creation/autocomplete V1 logic).
    *   Develop main table view (Shadcn Table) to display items in a selected stage.
    *   Implement "Move Forward" functionality:
        *   UI Action (Button/menu).
        *   Backend logic to update item's stage/sub-stage.
        *   Logic to determine "next" stage/sub-stage.
        *   Create `item_history` entries.
        *   Update Sidebar counts (real-time/refetch).
    *   Display basic Item History (detail view/modal).
    *   Implement basic time-in-stage display.
    *   Refine RLS & implement initial RBAC checks (Worker vs. Owner) for movement.

---

## Phase 3: Rework & Remarks (Sprint 3/4)

*   **Goal:** Implement critical rework functionality & remarks system.
*   **Tasks:**
    *   Implement "Send Back (Rework)" functionality:
        *   UI elements (button, modal).
        *   Modal: Select target previous stage/sub-stage, enter reason.
        *   Backend logic to update item status/location.
        *   Handle partial batch rework (track individual items).
        *   Update `item_history` correctly.
        *   Link rework reason to Remarks.
    *   Implement Remarks feature:
        *   UI for adding remarks (modal/panel).
        *   Backend logic to save remarks.
        *   Display remarks in item detail/history.
    *   Refine RBAC for rework permissions.

---

## Phase 4: Workflow Customization (Sprint 4/5)

*   **Goal:** Allow Owners to customize the workflow structure.
*   **Tasks:**
    *   Create UI settings section (Owner only) for workflow management.
    *   Implement CRUD operations (API routes/functions) for `workflow_stages`, `workflow_sub_stages`.
    *   Update Sidebar to display custom workflow dynamically.
    *   Modify "Move Forward" logic to respect custom order.
    *   Modify "Send Back (Rework)" logic to use custom stages.
    *   Handle edge cases (e.g., deleting stages with active items).

---

## Phase 5: Supporting Modules (Sprint 5/6)

*   **Goal:** Implement Packaging Reminders, PDF generation, basic Payment status.
*   **Tasks:**
    *   **Packaging:**
        *   UI for defining required materials per order.
        *   UI (Owner settings) for selecting reminder trigger stage.
        *   Backend logic/scheduled function (e.g., `pg_cron`) to check trigger.
        *   Integrate **Resend** API.
        *   Implement email sending logic.
        *   Implement basic in-app notification system.
    *   **PDF Generation:**
        *   Integrate PDF library (e.g., `@react-pdf/renderer`).
        *   Backend logic/function to fetch data for Vouchers/Invoices.
        *   Create basic templates (Vouchers, Invoices).
        *   Add download buttons (Owner only for Invoice/Voucher).
    *   **Payment Status:**
        *   Add Payment Status field to Orders schema.
        *   Implement UI (Owner only) to manually update status.
        *   Enforce Worker visibility restriction (RBAC).

---

## Phase 6: Reporting, Images & Polish (Sprint 6/7)

*   **Goal:** Implement basic reporting, image handling, refine UX.
*   **Tasks:**
    *   **Reporting:**
        *   Implement dashboard widget for item counts per stage.
        *   Implement basic CSV export for filtered item lists (Owner only).
    *   **Images:**
        *   Implement client-side image compression/resizing.
        *   Integrate Supabase Storage.
        *   UI for uploading images linked to items/stages.
        *   Display uploaded images.
        *   Implement Storage RLS policies.
    *   **UI/UX Polish:** Refine layouts, transitions, hover states, consistency per dark theme principles. Address usability issues.
    *   **Accessibility:** Perform thorough checks (keyboard navigation, focus, contrast).

---

## Phase 7: Testing, Deployment & Documentation (Sprint 7/8)

*   **Goal:** Final testing, production deployment prep, basic documentation.
*   **Tasks:**
    *   **End-to-End Testing:** Execute comprehensive test cases (core workflows, custom stages, rework, permissions). Consider automated E2E tools (Playwright/Cypress).
    *   **Performance Testing (Basic):** Check load times, query performance.
    *   **Security Review:** Double-check RLS, RBAC, input validation.
    *   **Final Bug Fixing.**
    *   **Production Environment Setup:** Configure Supabase production project, Vercel production deployment.
    *   **Basic User Documentation:** Create guides for core features.
    *   **Deployment:** Deploy V1 to production.

---

## Cross-Cutting Activities (Ongoing)

*   **Unit & Integration Testing.**
*   **Code Reviews.**
*   **Dependency Updates.**
*   **Error Monitoring Setup (e.g., Sentry).**
*   **Feedback Incorporation (if applicable).**

---

This plan provides a sequential structure. Adjust sprint content and duration based on team velocity and complexity discovered during development.