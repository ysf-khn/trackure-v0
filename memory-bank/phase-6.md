# Trackure V1 - Implementation Plan: Phase 6 Detailed Tasks

**Phase Goal:** Implement basic reporting (dashboard counts, CSV export), integrate image upload/viewing functionality with client-side optimization, and perform final UI/UX polishing and accessibility checks.

_(Prerequisites: Phase 5 completed - Supporting modules like packaging, PDF generation, payment status are functional. Core tracking, rework, and workflow customization are stable)._

---

## Tasks Breakdown:

**1. Reporting (Basic V1):**

- **1.1. Confirm Dashboard Widgets:**
  - **Action:** Review the implementation of the dashboard widgets (Quick Stats, Workflow Overview - planned in the Dashboard phase). Ensure the underlying queries are performant and the displayed counts are accurate.
- **1.2. CSV Export - Backend API:**
  - **Action:** Create a new API route (e.g., `src/app/api/items/export/route.ts` - handling GET).
  - **Action:** This route should accept optional filter parameters (e.g., `stageId`, `subStageId`, `orderId`, `dateRange`) via query string.
  - **Action:** Validate input parameters.
  - **Action:** Verify user authentication and 'Owner' role (RBAC for export). Get `organization_id`.
  - **Action:** Build a dynamic Supabase query based on the filter parameters to fetch relevant `items` data (including instance details, current stage/sub-stage name, order info). Include necessary JOINs.
  - **Action:** Choose and install a CSV generation library (e.g., `papaparse` for server-side use, or manually format CSV string).
  - **Action:** Convert the fetched data into CSV format.
  - **Action:** Set appropriate HTTP headers (`Content-Type: text/csv`, `Content-Disposition: attachment; filename="trackure_export.csv"`).
  - **Action:** Return the generated CSV data in the response. Handle potential errors during data fetching or CSV generation.
- **1.3. CSV Export - Frontend UI:**
  - **Action:** Add an "Export CSV" button in the main Item List view (where items are displayed per stage).
  - **Action:** Conditionally render this button only for the 'Owner' role.
  - **Action:** When clicked, trigger a call to the backend API endpoint (1.2). Pass the current filter parameters (e.g., selected stage ID) in the request URL. The browser should handle the file download based on the response headers.
  - **Action:** Provide visual feedback during the export process (e.g., brief loading state on the button).

**2. Image Management:**

- **2.1. Client-Side Optimization Library:**
  - **Action:** Choose and install a library (e.g., `browser-image-compression`). `npm install browser-image-compression`.
  - **Action:** Implement a utility function (`src/lib/image-utils.ts`) that takes a File object, applies resizing (e.g., max width/height) and compression (e.g., target size or quality level, output to WebP if desired), and returns the optimized File/Blob.
- **2.2. Supabase Storage Setup:**
  - **Action:** Create a Supabase Storage bucket (e.g., `item-images`).
  - **Action:** Define Storage Policies (RLS) for the bucket:
    - Allow authenticated users to `SELECT` images associated with their `organization_id`.
    - Allow authenticated users (`Owner` or `Worker`) to `INSERT` images linked to their `organization_id`.
    - Restrict `UPDATE`/`DELETE` based on roles or ownership if needed (V1 might allow deletion by uploader/Owner). Linkage via metadata.
- **2.3. Image Upload Component (`ImageUploader.tsx`):**
  - **Action:** Create a reusable component for handling image uploads.
  - **Action:** Use Shadcn `Input type="file"` or a drag-and-drop library.
  - **Action:** On file selection:
    - Call the client-side optimization utility (2.1).
    - Show a preview and progress indicator.
    - Use the Supabase client library (`upload` method) to upload the _optimized_ file to the designated Storage bucket. Structure the file path logically (e.g., `/:organization_id/:item_id/:timestamp_:filename`).
  - **Action:** On successful upload, get the public URL (or path) and call a backend API (2.4) to associate the image with the item/stage.
- **2.4. Backend API for Image Association:**
  - **Action:** Create an API route (e.g., `POST /api/items/[itemId]/images`) or integrate into the Remarks API if images are attached to remarks.
  - **Action:** Expect image metadata (e.g., storage path/URL, filename, size, potentially linked `stage_id` or `remark_id`). Validate input.
  - **Action:** Verify auth, role, and ownership (`organization_id`).
  - **Action:** Store the image metadata. Options:
    - Add an `image_urls (text[])` or `images (jsonb)` column to the `items` or `remarks` table.
    - _Or (More scalable):_ Create an `item_images` table (`id`, `item_id`, `remark_id`?, `storage_path`, `filename`, `uploaded_by`, `uploaded_at`, `organization_id`). Choose based on expected volume/query needs.
- **2.5. UI Integration for Upload:**
  - **Action:** Integrate the `ImageUploader` component into relevant areas (e.g., Add Remark modal, Item Detail view).
- **2.6. Image Viewing:**
  - **Action:** In areas where images are relevant (Item Detail view, Remarks display), fetch the associated image metadata (URLs/paths).
  - **Action:** Render images using `<img>` tags, using the fetched URL (Supabase provides public URLs or signed URLs depending on bucket policy).
  - **Action:** Consider using Shadcn `Dialog` or a lightbox library for viewing larger versions of images.

**3. UI/UX Polish:**

- **3.1. Workflow Review:**
  - **Action:** Manually step through all core user flows (login, order creation, item add, move forward, rework, workflow customization, packaging setup, PDF download, image upload/view) from both 'Owner' and 'Worker' perspectives.
  - **Action:** Identify any confusing steps, awkward layouts, or points of friction.
- **3.2. Layout & Spacing Consistency:**
  - **Action:** Review all pages and components. Ensure consistent use of padding, margins, gaps (leveraging Tailwind theme). Check alignment of elements.
- **3.3. Transitions & Microinteractions:**
  - **Action:** Add subtle `transition-colors`, `duration-150` (or similar) classes to buttons, links, and interactive elements for smoother hover/focus states. Ensure focus states are visually clear.
- **3.4. Component Styling Review:**
  - **Action:** Verify consistent styling for all instances of core Shadcn components (Buttons, Inputs, Tables, Cards, Modals, Selects, etc.) according to the dark theme.
- **3.5. Typography Review:**
  - **Action:** Check font usage (Inter/Poppins), heading hierarchy, line heights, and overall text readability across the application. Ensure sufficient contrast (part of accessibility).

**4. Accessibility Checks:**

- **4.1. Keyboard Navigation:**
  - **Action:** Tab through all interactive elements on every page (links, buttons, inputs, selects, modals). Ensure logical tab order and that all elements are reachable.
- **4.2. Focus States:**
  - **Action:** Verify that all interactive elements have a clear, visible focus state (using the `--ring` variable defined in the theme).
- **4.3. Color Contrast:**
  - **Action:** Use browser developer tools or online contrast checkers to verify sufficient contrast ratios (WCAG AA minimum) for text on backgrounds, UI elements, and status indicators against the dark theme. Pay special attention to muted text and disabled states.
- **4.4. Screen Reader Testing (Basic):**
  - **Action:** Use a screen reader (e.g., NVDA, VoiceOver) to navigate key pages and forms. Check if labels are read correctly, if content order makes sense, and if interactive elements are properly identified. Ensure appropriate ARIA attributes are used where needed (Shadcn usually helps here).

---

**Phase 6 Acceptance Criteria:**

- 'Owner' users can successfully export filtered item data to a CSV file.
- Users can upload images associated with items/remarks, with client-side optimization applied.
- Uploaded images are securely stored in Supabase Storage with appropriate RLS.
- Associated images can be viewed within the application UI.
- Core user workflows feel smooth and intuitive after polishing.
- UI demonstrates consistent layout, spacing, typography, and component styling.
- Application passes basic accessibility checks (keyboard navigation, focus states, color contrast).
- Dashboard widgets accurately reflect current data.
