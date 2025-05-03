# Trackure V1 - Implementation Plan: Dashboard V1

**Phase Goal:** Create an informative dashboard page (e.g., `/app/dashboard`) providing users (Owners/Subs) with an actionable overview of operational status, including quick stats, workflow distribution, potential bottlenecks, and recent activity.

_(Prerequisites: Core tracking features implemented (Phases 1-3 minimum). Users can create orders/items, move items forward, record rework. `orders`, `items`, `item_history`, `workflow_stages` tables are populated with data. TanStack Query is set up for data fetching)._

---

## Tasks Breakdown:

**1. Dashboard Page Setup:**

- **1.1. Basic Layout:**
  - **Action:** Use Tailwind CSS grid or flexbox utilities to define the main layout areas for the dashboard widgets (e.g., top row for stats, main area for workflow/bottlenecks, side area for activity feed).

**2. Quick Stats Cards:**

- **2.1. Backend Query Logic:**
  - **Action:** Create a server-side function/API endpoint (or integrate into a dashboard data endpoint) to calculate:
    - `activeOrdersCount`: `SELECT COUNT(*) FROM orders WHERE organization_id = :orgId AND <final_stage_condition_met> = false;` (Define `<final_stage_condition_met>` based on 'Ready for Dispatch').
    - `activeItemsCount`: `SELECT COUNT(*) FROM items JOIN orders ON items.order_id = orders.id WHERE orders.organization_id = :orgId AND <final_stage_condition_met> = false;`
  - **Action:** Ensure appropriate indexing on `orders.organization_id` and potentially status/stage columns.
- **2.2. Data Fetching Hook:**
  - **Action:** Create `hooks/queries/use-dashboard-stats.ts` using `useQuery` to fetch the calculated counts from the backend logic. Define query key (e.g., `['dashboard', 'stats', organizationId]`).
- **2.3. UI Component (`QuickStats.tsx`):**
  - **Action:** Create a component to display the stats.
  - **Action:** Use the hook (2.2) to fetch data.
  - **Action:** Render 2-3 individual Card components (Shadcn `Card`) displaying each stat with a clear label ("Active Orders", "Active Items").
  - **Action:** Implement loading state (e.g., skeleton text within cards) and basic error state display.

**3. Workflow Status Overview:**

- **3.1. Backend Query Logic:**
  - **Action:** Create a server-side function/API endpoint to fetch item counts per main stage:
    ```sql
    SELECT ws.id, ws.name, COUNT(i.id) as item_count
    FROM workflow_stages ws
    LEFT JOIN items i ON ws.id = i.current_stage_id AND i.organization_id = :orgId
    WHERE ws.organization_id = :orgId -- Or handle defaults correctly
    GROUP BY ws.id, ws.name
    ORDER BY ws.sequence_order;
    ```
  - **Action:** Ensure necessary indexes on `items.current_stage_id`, `items.organization_id`, `workflow_stages.organization_id`, `workflow_stages.sequence_order`.
- **3.2. Data Fetching Hook:**
  - **Action:** Create `hooks/queries/use-workflow-overview.ts` using `useQuery`. Define query key (e.g., `['dashboard', 'workflowOverview', organizationId]`).
- **3.3. UI Component (`WorkflowOverview.tsx`):**
  - **Action:** Create a component to display the overview.
  - **Action:** Use the hook (3.2) to fetch data.
  - **Action:** Render the data as a list or grid of elements, each showing `Stage Name: [Count]`.
  - **Action:** Wrap each stage name/count in a Next.js `<Link>` component pointing to the filtered view for that stage (e.g., `/app/items?stageId=<stage_id>`).
  - **Action:** Implement loading/error/empty states.

**4. Potential Bottlenecks / Longest in Stage:**

- **4.1. Backend Query Logic:**
  - **Action:** Create a server-side function/API endpoint. This query is more complex:
    ```sql
    -- Fetch latest history entry per item to get current stage entry time
    WITH LatestHistory AS (
        SELECT
            item_id,
            stage_id,
            sub_stage_id,
            entered_at,
            ROW_NUMBER() OVER(PARTITION BY item_id ORDER BY entered_at DESC) as rn
        FROM item_history
        WHERE organization_id = :orgId
    )
    SELECT
        i.id as item_id,
        i.sku,
        o.order_number,
        ws.name as stage_name,
        wss.name as sub_stage_name, -- Optional join if needed
        lh.entered_at,
        NOW() - lh.entered_at as time_in_stage_interval
    FROM items i
    JOIN orders o ON i.order_id = o.id
    JOIN LatestHistory lh ON i.id = lh.item_id AND lh.rn = 1
    JOIN workflow_stages ws ON i.current_stage_id = ws.id
    LEFT JOIN workflow_sub_stages wss ON i.current_sub_stage_id = wss.id -- Optional join
    WHERE i.organization_id = :orgId
      AND i.current_stage_id != <final_stage_id> -- Exclude completed items
    ORDER BY time_in_stage_interval DESC
    LIMIT 10; -- Or 5
    ```
  - **Action:** Ensure necessary indexes on `item_history(item_id, entered_at)`, `items(organization_id, current_stage_id)`.
- **4.2. Data Fetching Hook:**
  - **Action:** Create `hooks/queries/use-bottleneck-items.ts` using `useQuery`. Define query key.
- **4.3. UI Component (`BottleneckList.tsx`):**
  - **Action:** Create a component using Shadcn `Table` or a simple list.
  - **Action:** Use the hook (4.2) to fetch data.
  - **Action:** Display columns: Item ID/SKU, Order #, Current Stage, Time in Stage (format the interval using `date-fns` `formatDistanceToNowStrict` or similar).
  - **Action:** Make Item/Order identifiers clickable links.
  - **Action:** Implement loading/error/empty states ("No potential bottlenecks found").

**5. Recent Activity Feed:**

- **5.1. Backend Query Logic:**
  - **Action:** Create a server-side function/API endpoint. This likely involves `UNION ALL` across relevant tables or a dedicated `activity_log` table (if implemented). Example using `UNION ALL`:
    ```sql
    (
        SELECT id, 'Order Created' as type, created_at as timestamp, order_number as detail FROM orders WHERE organization_id = :orgId
        ORDER BY created_at DESC LIMIT 5
    )
    UNION ALL
    (
        SELECT ih.id, ih.action_taken as type, ih.entered_at as timestamp, i.sku as detail
        FROM item_history ih JOIN items i ON ih.item_id = i.id
        WHERE ih.organization_id = :orgId AND ih.action_taken IS NOT NULL -- Filter for specific logged actions
        ORDER BY ih.entered_at DESC LIMIT 5
    )
    UNION ALL
    (
        SELECT r.id, 'Remark Added' as type, r.timestamp as timestamp, i.sku as detail
        FROM remarks r JOIN items i ON r.item_id = i.id
        WHERE r.organization_id = :orgId
        ORDER BY r.timestamp DESC LIMIT 5
    )
    ORDER BY timestamp DESC
    LIMIT 10; -- Overall limit
    ```
  - _(Note: This query can become complex/less performant. A dedicated `activity_log` table populated via triggers or explicit logging might be better long-term)_.
  - **Action:** Ensure indexes on timestamp columns.
- **5.2. Data Fetching Hook:**
  - **Action:** Create `hooks/queries/use-recent-activity.ts` using `useQuery`. Define query key.
- **5.3. UI Component (`ActivityFeed.tsx`):**
  - **Action:** Create a component displaying a simple list.
  - **Action:** Use the hook (5.2) to fetch data.
  - **Action:** Map over results, formatting each entry based on `type` (e.g., "Order #123 Created - 5m ago", "Item ABC Moved - 1h ago").
  - **Action:** Add links where relevant.
  - **Action:** Implement loading/error/empty states.

**6. Dashboard Assembly & Actions:**

- **6.1. Combine Widgets:**
  - **Action:** In the main dashboard page component (`app/(app)/dashboard/page.tsx`), import and arrange the created widget components (`QuickStats`, `WorkflowOverview`, `BottleneckList`, `ActivityFeed`) using the grid layout.
- **6.2. "Create Order" Button:**
  - **Action:** Ensure the "Create New Order" button (from Phase 0/2) is prominently placed on the dashboard layout.

---

**Phase Acceptance Criteria:**

- Dashboard page loads for authenticated users.
- Quick Stats cards display correct counts for active orders/items.
- Workflow Overview widget correctly displays item counts per main stage, and stage names are clickable links.
- Potential Bottlenecks widget displays the top items by time-in-stage with relevant details and links.
- Recent Activity Feed displays a list of recent, relevant actions chronologically.
- All widgets handle loading, error, and empty states appropriately.
- "Create New Order" button is present and functional.
- Dashboard layout is well-organized and uses the established dark theme.
- Database queries for dashboard data are reasonably performant and indexed.
