# Trackure V1 - Implementation Plan: Onboarding Flow

**Phase Goal:** Implement a guided onboarding process for the _first user ('Owner')_ of a new organization, handling profile naming, organization creation, mandatory initial workflow definition (using existing customization features), and optional team invites, before granting access to the main application. Ensure invited users bypass this flow.

_(Prerequisites: All other V1 features implemented, including Auth, Workflow Customization APIs/UI, Team Invite API. Core DB tables exist.)_

---

## Tasks Breakdown:

**1. Onboarding State & Routing:**

- **1.1. Add Onboarding Status:**
  - **Action:** Add `onboarding_status` column (e.g., `text`, nullable, default `'pending_profile'`) to the existing `profiles` table. Define statuses: `'pending_profile'`, `'pending_org'`, `'pending_workflow'`, `'pending_invites'`, `'complete'`. Apply migration.
- **1.2. Implement Onboarding Middleware/Check:**
  - **Action:** Create/Update `src/middleware.ts` (or use logic in root/app layouts).
  - **Action:** After ensuring user is authenticated, fetch their `profiles` record.
  - **Action:** Add redirect logic:
    - If `profile.onboarding_status` is `'complete'`, allow `/app/*`, redirect from `/onboarding/*`.
    - If `profile.onboarding_status` is **not** `'complete'`, redirect to the corresponding `/onboarding/[status]` route (e.g., `/onboarding/profile`). Deny `/app/*`.
    - Handle the edge case where `profile` might not exist immediately after signup (before DB trigger runs) - redirect to `/onboarding/profile` or a loading state.
- **1.3. Create Onboarding Layout & Routes:**
  - **Action:** Create route group `(onboarding)` with a simple layout (`src/app/(onboarding)/layout.tsx`).
  - **Action:** Create page files for each step: `/profile`, `/organization`, `/workflow`, `/invite`.

**2. Onboarding Step 1: Profile Setup:**

- **2.1. Build Page:** `src/app/(onboarding)/profile/page.tsx`.
- **2.2. Build UI:** Simple form for "Full Name" (`Input`), "Next" button (`Button`). Use existing Shadcn components, RHF+Zod.
- **2.3. Build API (`PUT /api/profiles/me`):**
  - **Action:** Create this _new_ API route.
  - **Action:** Validate input (`full_name`). Verify auth.
  - **Action:** `UPDATE` `profiles` set `full_name` and set `onboarding_status = 'pending_org'` WHERE `id = auth.uid()`.
- **2.4. Integrate Frontend:** Use `useMutation` on the form. On success, `router.push('/onboarding/organization')`. Handle states.

**3. Onboarding Step 2: Organization Creation:**

- **3.1. Build Page:** `src/app/(onboarding)/organization/page.tsx`.
- **3.2. Build UI:** Form for "Organization Name" (`Input`), "Create & Continue" button (`Button`). RHF+Zod.
- **3.3. Build API (`POST /api/organizations/setup` - Onboarding Version):**
  - **Action:** Create this _new_ API route.
  - **Action:** Verify auth & check `profiles.onboarding_status == 'pending_org'`. Validate input (`organization_name`).
  - **Action:** Perform DB transaction:
    1.  `INSERT` into `organizations`. Get `new_organization_id`.
    2.  `UPDATE` user's `profiles`: set `organization_id = new_organization_id`, set `role = 'Owner'`, set `onboarding_status = 'pending_workflow'`.
    3.  **DO NOT** copy workflow defaults here.
  - **Action:** Handle errors. Return success.
- **3.4. Integrate Frontend:** `useMutation`. On success, `router.push('/onboarding/workflowsetup')`. Handle states.

**4. Onboarding Step 3: Define Initial Workflow:**

- **4.1. Build Page:** `src/app/(onboarding)/workflowsetup/page.tsx`.
- **4.2. Reuse Existing Components/APIs:**
  - **Action:** Fetch the user's _existing_ workflow management APIs (CRUD + Reorder for stages/sub-stages - assumed complete).
  - **Action:** Reuse the _existing_ interactive `WorkflowEditor` UI component (assumed complete).
- **4.3. Integrate Editor into Page:**
  - **Action:** Add instructional text ("Define your initial workflow stages and sub-stages...").
  - **Action:** Embed the `WorkflowEditor` component. It should fetch the (currently empty) workflow for the new org and allow adding/editing via its internal API calls.
- **4.4. Navigation Logic (Crucial):**
  - **Action:** Add "Save & Continue" and "Complete Setup Later" buttons.
  - **Action:** Create API Route: `POST /api/onboarding/advance`. Verifies auth & `onboarding_status == 'pending_workflow'`, updates `profiles.onboarding_status` to `'pending_invites'`.
  - **Action:** Both buttons call this API via `useMutation`. On success, `router.push('/onboarding/invite')`. The "Save & Continue" implies they finished editing _for now_, "Complete Later" implies they might have an empty/partial workflow.
  - _(Note: Add validation/prompt if workflow is empty on "Save & Continue"? Optional V1 refinement)._

**5. Onboarding Step 4: Invite Team (Optional):**

- **5.1. Build Page:** `app/(onboarding)/invite/page.tsx`.
- **5.2. Reuse Existing Components/APIs:**
  - **Action:** Build UI form (Email `Input`, Role `Select` - likely only 'Worker' shown here, "Send Invite" `Button`, "Finish Setup" `Button`). RHF+Zod.
  - **Action:** The "Send Invite" button calls the _existing_ Team Invite API (`POST /api/team/invites` [create if not yet created]) using `useMutation`. Show feedback.
- **5.3. API Call to Complete Onboarding:**
  - **Action:** Create API Route: `POST /api/onboarding/complete`. Verifies auth & `onboarding_status == 'pending_invites'`. Updates `profiles.onboarding_status` to `'complete'` Provide a skip option too. Mark the onboarding status complete for both scenarios as it's an optional step.
  - **Action:** The "Finish Setup" button (used after sending invites or instead of sending any) calls this API via `useMutation`.
  - **Action:** On successful completion, `router.push('/app/dashboard')`. Handle states.

**6. Handling Invited Users (Verification):**

- **6.1. Verify DB Trigger:**
  - **Action:** Ensure the Supabase DB trigger `on_auth_user_created` exists and correctly populates the `profiles` table for invited users (`id`, `organization_id`, `role`) and **sets `onboarding_status = 'complete'`**.
- **6.2. Verify Middleware/Routing:**
  - **Action:** Test the login flow for an invited user. Confirm the middleware check (1.2) sees the `'complete'` status and routes them directly to `/app/dashboard`.

**7. Service Role Key Security (Verification):**

- **Action:** Confirm the `SUPABASE_SERVICE_ROLE_KEY` is used _only_ in secure backend contexts (specifically for the Team Invite API) and is not exposed client-side.

---

**Onboarding Flow Acceptance Criteria:**

- New, uninvited users are correctly routed through the `/onboarding/*` steps after signup.
- Owners successfully set their name and create their organization.
- Owners are presented with the workflow editor and can define/modify their initial stages/sub-stages using the existing customization tools.
- Owners can proceed from the workflow step ("Save & Continue" or "Complete Later").
- Owners can optionally send team invites during onboarding using the existing invite mechanism.
- Owners successfully complete the onboarding flow, their `onboarding_status` is set to `'complete'`, and they are redirected to the main dashboard.
- Invited users completely bypass the onboarding UI and are directed to the dashboard after signing up via their invite link.
- Appropriate API routes, state management, and redirects handle the flow correctly.
