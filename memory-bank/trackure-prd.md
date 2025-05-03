# Trackure - Product Requirements Document (PRD)

*   **Version:** 1.0
*   **Date:** October 26, 2023
*   **Status:** Draft
*   **Author:** Yusuf

---

## 1. Introduction

Trackure is a B2B SaaS application designed specifically for **export firms** to manage, track, and gain visibility into their internal multi-stage production and preparation workflow. It addresses the challenges of tracking items through complex processes involving manufacturing, quality checks, finishing, customization, rework loops, and packaging, providing real-time insights and improving operational efficiency. This system serves as an internal tool for the exporter's team.

## 2. Goals & Objectives

*   **Increase Visibility:** Provide real-time status, location, and progress tracking for every item or batch throughout the entire workflow.
*   **Improve Efficiency:** Reduce time spent manually tracking items, identify bottlenecks through time tracking, and streamline handoffs between stages.
*   **Enhance Quality Control:** Effectively manage Quality Check (QC) stages and the rework process for items failing inspection.
*   **Streamline Communication:** Facilitate clear communication and record-keeping through stage-specific remarks.
*   **Centralize Data:** Consolidate item details, process history, packaging requirements, and basic financial status in one system.
*   **Improve Planning:** Provide reminders for long lead-time tasks like ordering specific packaging materials.

## 3. Target Audience

*   **Primary Users:** Export companies managing physical product production/preparation workflows internally.
*   **User Roles (within the company - V1):**
    *   **Owner:** Full administrative and operational control.
    *   **Worker:** Operational user with restricted access.

## 4. Features & Functional Requirements (V1)

### 4.1. Core Workflow Management & Customization

*   **4.1.1. Default Workflow:** System provides a default set of stages and sub-stages based on common export processes (e.g., Order Intake, Manufacturing [Sub-stages], Checking, Customization [Sub-stages], Finishing [Sub-stages], Packaging).
*   **4.1.2. Workflow Customization (Owner Role):**
    *   Users with the 'Owner' role can customize the workflow structure.
    *   **Add/Edit/Delete Stages:** Ability to add new custom main stages at any point in the sequence. Ability to edit names or delete custom stages (handling for items in deleted stages required). Ability to reorder stages.
    *   **Add/Edit/Delete Sub-stages:** Ability to add new custom sub-stages within any main stage (default or custom). Ability to edit names or delete custom sub-stages. Ability to reorder sub-stages within a main stage.
*   **4.1.3. Item Progression:** Users (based on role permissions) can move items/batches forward through the defined workflow (default or custom).
*   **4.1.4. Stage Navigation (UI):** Sidebar navigation dynamically reflects the current workflow structure (including custom stages/sub-stages), showing item counts. Clicking a stage displays items within it in a Table View in the main content area.

### 4.2. Rework Management

*   **4.2.1. Backward Movement:** At QC points or any stage, authorized users can send specific items (or partial batches) back to a *previous* stage/sub-stage.
*   **4.2.2. Rework Tracking:** System must record:
    *   Which items/quantity were sent back.
    *   Stage sent *from*.
    *   Stage sent *to*.
    *   Reason for rework (selected from predefined list or free text, linked to Remarks).
    *   Timestamp of rework initiation.
*   **4.2.3. Batch Splitting:** System handles scenarios where only part of a batch is sent back, tracking the "good" and "rework" portions separately.

### 4.3. Item Tracking & Details

*   **4.3.1. Implicit Item Master/Catalog:** The system maintains an internal catalog of items the company handles, built automatically over time.
*   **4.3.2. Item Identifier (SKU Recommended):** The primary identifier for items is expected to be a unique **SKU** (Stock Keeping Unit) or equivalent code. The system will strongly recommend/guide users towards using unique SKUs for reliable tracking and master data association.
*   **4.3.3. Adding Items to Orders (Autocomplete & Implicit Creation):**
    *   When adding items to an order, users type the item's **SKU** (or identifier).
    *   The system provides an **autocomplete search** against the internal Item Master based on this identifier.
    *   If a match is found, its stored master details (Weight, Size, Box Size, Carton Size, Pieces per carton, Net Weight, Gross Weight, Volume (CBM)) are pre-filled. Users can override these details for the specific order instance.
    *   If **no match** is found for the entered SKU, the user enters the item details manually. Upon saving, the system **automatically creates a new entry** in the internal Item Master using these details and the SKU provided. This initial entry becomes the reference master data for that SKU.
*   **4.3.4. Master Data Immutability (V1):** In V1, the master item details created upon first entry are **not editable** through a dedicated interface. Subsequent uses of the same SKU will pre-fill these master details, but any overrides only apply to the specific order instance and **do not update** the master record. (Master data editing/cleanup is out of scope for V1).
*   **4.3.5. Unique Item/Batch ID:** Each item or batch instance being tracked within an order needs a unique identifier (distinct from the SKU/Master ID).
*   **4.3.6. Status & Location Tracking:** System must always reflect the current stage, sub-stage (of the defined workflow), and status (e.g., 'In Progress', 'Awaiting QC', 'In Rework') of each item instance.
*   **4.3.7. Item History/Timeline:** Maintain a log of when an item instance entered/exited each stage/sub-stage, including rework loops. (Visible to both Owner and Worker).

### 4.4. Time Tracking

*   **4.4.1. Time in Stage:** Automatically calculate and display the time an item has spent in its current stage/sub-stage.
*   **4.4.2. Historical Time:** Store time spent in previous stages for reporting/analysis (Basic reporting in V1).

### 4.5. Packaging Logistics

*   **4.5.1. Material Definition:** At order intake or an early stage, users define required packaging materials (e.g., Box Type A, Velvet Insert, Thermocol Sheet) for the order/items.
*   **4.5.2. Reminder System:** System sends a notification/reminder (in-app and via **Resend** email) to prompt ordering of required materials.
*   **4.5.3. User-Defined Trigger:** The specific stage/sub-stage that triggers this reminder is selected by the user (Owner role likely sets this up, maybe per order type or globally).

### 4.6. User Management & Multi-Tenancy

*   **4.6.1. Organization Accounts:** System supports multiple isolated company accounts (Tenants).
*   **4.6.2. Data Isolation:** Strict data segregation between tenants using Supabase Row Level Security (RLS) based on `organization_id`.
*   **4.6.3. User Roles & Permissions (V1):**
    *   **Owner:** Full access to all features, data, settings, user management, workflow customization, reports, financial record-keeping (Payment Status), invoicing, voucher generation.
    *   **Worker:**
        *   **Can:** View dashboard/item lists; View full details & history of items; Move items between assigned stages; Perform QC actions; Add Remarks; Upload Images; Manage packaging stage tasks (view required materials, mark as completed).
        *   **Cannot:** Access/Edit Payment Status fields; Generate Invoices; Generate Vouchers; Access company-wide Settings; Customize Workflows; Manage Users; Access potentially sensitive aggregate reports (e.g., overall financial summaries, cross-order performance metrics - specific report restrictions TBD).
*   **4.6.4. User Authentication:** Managed via Supabase Auth (Email/Password).

### 4.7. Documentation & Vouchers

*   **4.7.1. Voucher Generation:** Ability to generate downloadable PDF vouchers for items/orders (Owner role only).
*   **4.7.2. Voucher Content:** Vouchers include key item details, current status/stage, order information, potentially history summary.
*   **4.7.3. Voucher Types:** Support for "Main Voucher" and potentially "Return Voucher" (for rework or returns).

### 4.8. Communication (Remarks)

*   **4.8.1. Stage-Specific Remarks:** Users (Owner & Worker) can add timestamped comments/remarks to an item or batch at any stage/sub-stage.
*   **4.8.2. Remark Visibility:** Remarks are visible in the item's history/details view. Used for instructions, QC notes, rework reasons etc.

### 4.9. Financials (V1 Basic - Internal Record)

*   **4.9.1. Payment Status Tracking (Internal Record):** Ability for 'Owner' users to manually mark orders/items with a basic payment status (e.g., Lent, Credit, Paid) for their *internal record-keeping*. This does *not* involve processing payments for the exporter's customers.
*   **4.9.2. Invoicing (V1 Basic):** Generate a simple downloadable PDF invoice based on order details. Access restricted to 'Owner' role.

### 4.10. Reporting (V1 Basic)

*   **4.10.1. Current Status Report:** Dashboard/view showing counts of items per stage/sub-stage (Visible to Owner & Worker).
*   **4.10.2. Order/Item List View:** Table view of items with filtering by stage, status, order ID (Visible to Owner & Worker).
*   **4.10.3. Data Export (Basic):** Ability to export filtered item lists to CSV (Likely Owner role only).

### 4.11. Image Management

*   **4.11.1. Image Upload:** Ability for users (Owner & Worker) to upload images related to an item, potentially associated with specific stages (e.g., QC failure photo).
*   **4.11.2. Storage:** Images stored securely in Supabase Storage, linked to item/stage records.
*   **4.11.3. Optimization:** Implement client-side image resizing/compression before upload to save bandwidth and storage.

## 5. Design & UX Requirements

*   **Theme:** Dark theme only for V1.
*   **Aesthetic:** Modern, clean, professional, visually appealing ("Treat for the eyes"). Focus on clarity and usability.
*   **Layout:** Primarily Sidebar (for stage navigation) + Main Content Area (for tables/details).
*   **Color Palette:** Based on Dark Gray/Black primary (`#181818` range), vibrant Electric Blue (`#3366FF` range) accent, clear status colors (Green, Yellow, Red) with high contrast.
*   **Typography:** Inter (sans-serif) for body/UI text, Poppins (sans-serif) for headings. Clear hierarchy.
*   **Components:** Utilise Shadcn/ui library for consistent UI elements (Buttons, Forms, Tables, Modals etc.), styled according to the theme.
*   **Responsiveness:** Primarily designed for desktop use, but basic responsiveness for tablet viewing is desirable.
*   **Accessibility:** Ensure sufficient color contrast (WCAG AA target), keyboard navigation support, clear focus states.
*   **Interaction:** Smooth transitions, clear feedback on actions.

## 6. Technical Requirements & Stack

*   **Framework:** Next.js (App Router)
*   **Backend/Database:** Supabase (PostgreSQL DB, Auth, Storage, Realtime Subscriptions, Edge Functions where needed)
*   **UI Library:** Shadcn/ui
*   **Styling:** Tailwind CSS
*   **State Management:** TanStack Query (Server State), Zustand/Jotai (Client State, if needed)
*   **Forms:** React Hook Form + Zod (Validation)
*   **Date/Time:** date-fns or Day.js
*   **PDF Generation:** Suitable library (e.g., @react-pdf/renderer, pdf-lib)
*   **Email Service:** Integrate with **Resend** API for transactional emails (packaging reminders, potentially user invites etc.).
*   **Key Non-Functional:**
    *   **Multi-Tenancy:** Robust RLS implementation in Supabase.
    *   **Image Optimization:** Client-side resizing/compression mandatory.
    *   **Database Performance:** Appropriate indexing on key tables/columns. Efficient query design.
    *   **Realtime:** Use Supabase subscriptions efficiently for live updates on dashboards/tables.
    *   **Security:** Server-side validation (Zod), RLS enforcement, RBAC checks for sensitive actions, standard web security practices.
    *   **Workflow Engine:** Robust backend logic and database schema to handle the dynamic/customizable workflow structure.
    *   **Implicit Item Master Logic:** Backend logic required to handle searching, pre-filling, and automatic creation of master items based on SKU.

## 7. Release Criteria / V1 Scope

V1 is considered releasable when all features listed in Section 4 are implemented, tested (including core workflows, custom workflows, rework loops, RLS/RBAC security, implicit item master), and meet the basic Design/UX requirements. Focus is on core tracking, customizable workflow management with rework, and basic reporting/documentation/financial record-keeping.

## 8. Future Considerations (Out of Scope for V1)

*   Advanced Reporting & Analytics (Custom reports, bottleneck analysis charts, yield reports)
*   External Integrations (Accounting, Shipping, ERP)
*   Advanced Workflow Customization (Visual editor, complex transition rules)
*   Detailed Resource Management (Machine/Operator tracking)
*   Light Theme
*   Advanced Invoicing features (Calculations, templates)
*   Mobile-specific app/views
*   API for third-party access
*   Dedicated Item Master Management Interface (Editing, merging duplicates)

## 9. Success Metrics

*   User Adoption Rate (Number of companies/users actively using the platform).
*   Feature Usage Frequency (Tracking movement, rework initiation, workflow customization, voucher generation).
*   Task Completion Time (Average time to update item status, handle rework).
*   Reduction in User-Reported Errors/Lost Items (Qualitative feedback).
*   User Satisfaction Surveys/Feedback Scores (NPS, CSAT).

## 10. Open Questions (V1 Resolved)

*   *Previous questions resolved through discussion.*

---