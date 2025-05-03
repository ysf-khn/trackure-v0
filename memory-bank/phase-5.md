# Trackure V1 - Implementation Plan: Phase 5 Detailed Tasks (Updated)

**Phase Goal:** Implement Packaging Logistics (material definition, **per-order user-defined reminders** via Resend), PDF generation (Vouchers/Invoices - Owner only), and basic Payment Status recording (Owner only).

_(Prerequisites: Phase 4 completed - Workflow customization is functional. Core tracking and rework are implemented. Users roles and RBAC are established. Order Creation/Editing UI exists)._

---

## Tasks Breakdown:

**1. Packaging Logistics (Per-Order Trigger):**

- **1.1. Data Model Update:**
  - **Action:** Ensure the `orders` table includes:
    - `required_packaging_materials (jsonb or text[])` (Confirm data type choice).
    - `packaging_reminder_trigger_stage_id (uuid, fk->workflow_stages, nullable)`.
    - `packaging_reminder_trigger_sub_stage_id (uuid, fk->workflow_sub_stages, nullable)`.
    - `packaging_reminder_sent (boolean, default false, not null)`.
  - **Action:** Apply necessary database migrations/changes.
- **1.2. UI for Defining Materials & Trigger (Order Creation/Edit):**
  - **Action:** Locate the Order Creation form (from Phase 2) and implement/locate an Order Edit form/page.
  - **Action:** Within these forms, add/ensure sections for:
    - Inputting `required_packaging_materials` (e.g., Textarea, dynamic list).
    - A `Select` component (Shadcn `Select`) labeled "Send Packaging Reminder When Items Reach:".
  - **Action:** Populate this `Select` dynamically by fetching the specific organization's current workflow stages and sub-stages (use `useWorkflowStructure` hook or similar query). Display names clearly (e.g., "Stage: Manufacturing", "Sub-stage: Polishing").
  - **Action:** Allow the user to select one stage OR one sub-stage from the list. Store the corresponding ID(s) (`packaging_reminder_trigger_stage_id`, `packaging_reminder_trigger_sub_stage_id`) in the form state.
  - _(Optional: Consider pre-selecting a default based on future organization settings)._
- **1.3. Backend API Update (Order Create/Update):**
  - **Action:** Modify the API route(s) handling Order creation (POST `/api/orders`) and Order updates (e.g., PUT/PATCH `/api/orders/[orderId]`).
  - **Action:** Ensure these routes accept and validate the `required_packaging_materials`, `packaging_reminder_trigger_stage_id`, and `packaging_reminder_trigger_sub_stage_id` fields.
  - **Action:** Save these values to the corresponding `orders` record in the database.
- **1.4. Resend API Integration:**
  - **Action:** Verify Resend account is set up, API key is stored securely as an environment variable.
  - **Action:** Verify Resend SDK (`npm install resend`) is installed.
- **1.5. Backend Scheduled Task/Logic (Revised):**
  - **Action:** Set up a Supabase Scheduled Edge Function or `pg_cron` job to run periodically (e.g., every hour).
  - **Action:** Implement the function's logic:
    1.  Select `orders` where `packaging_reminder_trigger_stage_id` OR `packaging_reminder_trigger_sub_stage_id` is NOT NULL AND `packaging_reminder_sent = false`.
    2.  For each such `order`:
        a. Get the specific `trigger_stage_id` / `trigger_sub_stage_id` for _that order_.
        b. Check if any `item` associated with that `order_id` has _recently entered_ that trigger stage/sub-stage (e.g., check `item_history` records where `entered_at` is within the last interval + buffer and matches the trigger IDs).
        c. If an item match is found:
        i. Fetch `required_packaging_materials` from the `orders` record.
        ii. Fetch Owner email(s) for the `organization_id` from `profiles`.
        iii.Prepare email data (Order #, Required Materials, Trigger Stage Name).
        iv. **Call Task 1.6 (Email Sending Logic).**
        v. **(If implemented) Call Task 1.7 (In-App Notification Logic).**
        vi. **Update the specific `orders` record: SET `packaging_reminder_sent = true`.** (Crucial to prevent repeats).
        vii. Break or continue checking other orders.
- **1.6. Email Sending Logic:**
  - **Action:** Create a reusable function (e.g., in `src/lib/email/send-reminder.ts`) that accepts order details, materials, recipient email(s).
  - **Action:** Use the Resend SDK within this function to compose and send the formatted email reminder. Implement error handling and logging for email sends.
- **1.7. Basic In-App Notifications (V1 Simple):**
  - **Action:** (If implementing) Create/verify the `notifications` table schema.
  - **Action:** Modify the scheduled task (1.5.c.v) to also `INSERT` a record into the `notifications` table when an email is sent.
  - **Action:** Implement the UI element (e.g., Header icon/dropdown) to display unread notifications fetched via a `useQuery`.

**2. PDF Generation (Vouchers & Invoices - Owner Only):**

- **2.1. Integrate PDF Library:**
  - **Action:** Verify chosen library (e.g., `@react-pdf/renderer`) is installed.
- **2.2. Backend Data Fetching Logic:**
  - **Action:** Create/verify server-side functions to gather data for Vouchers (`itemId`) and Invoices (`orderId`), including necessary joins for details.
- **2.3. Basic PDF Templates:**
  - **Action:** Create/verify React components (`VoucherTemplate.tsx`, `InvoiceTemplate.tsx`) or functions for basic layout and data display.
- **2.4. API Route for PDF Generation:**
  - **Action:** Implement/verify API routes (`GET /api/vouchers/[itemId]`, `GET /api/invoices/[orderId]`).
  - **Action:** Enforce 'Owner' role RBAC. Fetch data, render PDF using library/template on the server, set headers, return PDF stream/buffer.
- **2.5. UI Download Actions:**
  - **Action:** Implement/verify "Download" buttons/links in the UI, accessible only to 'Owner' role, linking to the respective API endpoints.

**3. Payment Status Recording (Owner Only):**

- **3.1. Verify Schema:** Confirm `payment_status` exists on `orders` table.
- **3.2. UI Element for Status Update:**
  - **Action:** Implement/verify `Select` or `RadioGroup` in Order Detail UI, visible/editable only by 'Owner'. Options: Lent, Credit, Paid.
- **3.3. Backend API for Status Update:**
  - **Action:** Implement/verify API route (e.g., PUT/PATCH `/api/orders/[orderId]/payment-status`).
  - **Action:** Enforce 'Owner' role RBAC. Validate input. `UPDATE` the `payment_status` on the `orders` record.
- **3.4. Frontend Integration:**
  - **Action:** Implement/verify `useMutation` triggered on status change by Owner. Handle loading/success/error. Update UI display.

---

**Phase 5 Acceptance Criteria:**

- Users can specify required packaging materials and a reminder trigger stage/sub-stage when creating/editing an order.
- The backend scheduled task correctly identifies orders needing reminders based on item progression to the specified trigger point.
- Email reminders via Resend are successfully sent to the designated user(s) when triggered. Reminder status is tracked per order.
- (If implemented) Basic in-app notifications are generated for reminders.
- 'Owner' users can successfully generate and download basic PDF Vouchers and Invoices containing accurate data.
- 'Owner' users can successfully view and manually update the internal Payment Status for an order.
- 'Worker' users cannot access payment status fields or generate PDFs.
- All new/updated API endpoints include appropriate authentication, RBAC, and validation.
