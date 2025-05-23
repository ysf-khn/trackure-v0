# Trackure V1 - Implementation Plan: Phase 0 Detailed Tasks

**Goal:** Set up the project environment, basic authentication, core layout, and theme, establishing a solid foundation for subsequent phases.

---

## Tasks Breakdown:

**1. Project Initialization & Setup:**
_ **1.1.** Initialize Next.js Project:
_ Command: `npx create-next-app@latest trackure-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` (Adjust flags as needed).
_ Navigate into the project directory.
_ **1.2.** Configure Linters/Formatters: \* Review and potentially customize ESLint (`.eslintrc.json`) and Prettier (`.prettierrc`) configurations for consistency.

**2. Version Control:**
_ **2.1.** Initialize Git: `git init`.
_ **2.2.** Create `.gitignore`: Ensure standard Node/Next.js/OS files are ignored (often generated by `create-next-app`). Add `.env.local`.
_ **2.3.** Initial Commit: `git add . && git commit -m "Initial project setup"`.
_ **2.4.** Setup Remote Repository: Create a repository on GitHub/GitLab/etc., and push the initial commit (`git remote add origin <repo_url> && git push -u origin main`).

**3. Supabase Setup & Integration:**
_ **3.1.** Create Supabase Project: Via the Supabase dashboard.
_ **3.2.** Get Credentials: Note Project URL and `anon` key from Project Settings > API.
_ **3.3.** Configure Database (Minimal): Maybe create the `profiles` table early for linking user metadata (`id` referencing `auth.users`, `organization_id`, `role`).
_ **3.4.** Set Environment Variables:
_ Create `.env.local`.
_ Add `NEXT_PUBLIC_SUPABASE_URL=<Your_Project_URL>`
_ Add `NEXT_PUBLIC_SUPABASE_ANON_KEY=<Your_Anon_Key>`
_ **3.5.** Install Supabase Client: `npm install @supabase/supabase-js`.
_ **3.6.** Create Supabase Client Helpers:
_ `src/lib/supabase/client.ts` (for client components, uses env vars). \* `src/lib/supabase/server.ts` (for server components/actions - may need service role key later, but `anon` key often suffices initially with RLS).

**4. Authentication:**
_ **4.1.** Configure Supabase Auth: Enable Email/Password provider in Supabase Dashboard > Authentication > Providers. Disable others if not needed.
_ **4.2.** Install Shadcn Components: `npx shadcn-ui@latest add button input label card`.
_ **4.3.** Create Auth Routes:
_ `src/app/(auth)/login/page.tsx`
_ `src/app/(auth)/signup/page.tsx`
_ Use Route Group `(auth)` for potential shared layout/logic later.
_ **4.4.** Implement Auth Forms:
_ Build Login & Signup forms using Shadcn components and React Hook Form (`npm install react-hook-form zod @hookform/resolvers`).
_ Use Zod for basic email/password validation.
_ **4.5.** Implement Auth Logic:
_ Use Supabase client helpers to call `signInWithPassword`, `signUp`, `signOut` in form submission handlers (client components).
_ Handle loading states and display error messages.
_ **4.6.** Session Management:
_ Set up Supabase `onAuthStateChange` listener (e.g., in a global context provider or root layout client component) to react to login/logout events.
_ **4.7.** Protected Routes Middleware:
_ Create `src/middleware.ts`. \* Implement logic to check for user session (using Supabase helper) and redirect unauthenticated users accessing `/app` (or similar) to `/login`.

**5. Styling & Theming:**
_ **5.1.** Install Tailwind Plugins: `npm install tailwindcss-animate`.
_ **5.2.** Configure `tailwind.config.js`:
_ Set `darkMode: ["class"]`.
_ Ensure `content` paths (`./src/**/*.{ts,tsx}`, etc.) are correct.
_ Define dark theme `colors` using HSL variables (as per PRD) under `extend.colors`.
_ Define `fontFamily` (`sans` -> Inter, `heading` -> Poppins) using CSS variables (`var(...)`).
_ Define `borderRadius` variables (`lg`, `md`, `sm`) using `--radius`.
_ Include Shadcn `keyframes` and `animation`.
_ Add `require("tailwindcss-animate")` to `plugins`.
_ **5.3.** Configure `src/styles/globals.css`:
_ Include `@tailwind base/components/utilities`.
_ Define HSL `--color-variables` in `@layer base { :root { ... } }` (matching `tailwind.config.js`).
_ Define `--radius`.
_ Apply base styles (`@apply bg-background text-foreground font-sans`) to `body` in `@layer base`.
_ Apply heading font (`@apply font-heading`) to `h1-h6` in `@layer base`.
_ **5.4.** Font Setup (`next/font` Recommended): \* Set up Inter and Poppins using `next/font` in `src/app/layout.tsx` to generate and assign `--font-inter` and `--font-poppins` CSS variables.

**6. UI Library Integration (Shadcn/ui):**
_ **6.1.** Initialize Shadcn/ui: `npx shadcn-ui@latest init`.
_ Confirm settings: Dark mode, CSS Variables (`:root`), paths, etc. \* **6.2.** Test Components: Add a few components (Button, Card) to a test page to ensure styling from `globals.css` and `tailwind.config.js` is applied correctly.

**7. Core Layout & Routing:**
_ **7.1.** Define Root Layout (`src/app/layout.tsx`): Include font setup, theme provider (if needed), basic HTML structure.
_ **7.2.** Define Application Layout (`src/app/(app)/layout.tsx`):
_ Use Route Group `(app)` for protected routes.
_ Create placeholder components for `Sidebar` and `Header/Navbar`.
_ Structure the layout with Sidebar fixed/sticky and Main Content area flexible.
_ **7.3.** Define Application Entry Page (`src/app/(app)/dashboard/page.tsx` or `src/app/(app)/page.tsx`):
* This will be the main landing page *after* login. Show a placeholder title like "Trackure Dashboard".
* **7.4.** Root Page Placeholder (`src/app/page.tsx`): \* Keep this minimal for now. It could show "Trackure Landing Page Coming Soon" or immediately redirect authenticated users to `/app/dashboard` and unauthenticated users to `/login`.

**8. Basic Deployment (Vercel Recommended):**
_ **8.1.** Create Vercel Project: Link to your Git repository.
_ **8.2.** Configure Vercel:
_ Ensure framework preset is Next.js.
_ Add Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
_ **8.3.** Deploy: Trigger a deployment (e.g., push to `main`).
_ **8.4.** Test Staging: Verify login, signup, basic layout, and protected routes on the Vercel deployment URL.

---

**Phase 0 Acceptance Criteria:**

- Project initialized with Next.js, TypeScript, Tailwind.
- Supabase project created and client integrated.
- Basic user authentication (signup, login, logout) works.
- Dark theme correctly applied with defined colors and fonts (Inter/Poppins).
- Shadcn/ui components can be added and display correctly styled.
- Basic application layout (Sidebar + Main) exists within a protected route group (e.g., `/app`).
- Routing handles `/`, `/login`, `/signup`, and the protected `/app` routes correctly.
- Project successfully deploys to a staging environment (e.g., Vercel).
