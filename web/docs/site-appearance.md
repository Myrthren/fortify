# Universal site appearance

Owners can choose Classic or Sci-fi in `/admin` under **Site appearance**, then select **Apply site theme**. The selected choice applies to public pages, dashboards, the assistant and administration. The default is the approved Sci-fi theme. It is not a per-user preference.

The singleton `SiteAppearance` record (`id = global`) persists the choice, last editor and update time in the shared database. The setting uses the existing owner Discord allowlist. Anonymous visitors can read only the selected theme; writes require an authenticated owner and a same-origin request.

## Deployment

Production Netlify builds run `scripts/ensure-site-appearance.cjs` after generating Prisma Client and before compiling the site. This applies the focused, idempotent SQL addition using the existing production connection and verifies that the theme can be read. A failure stops the deployment, retaining the previously published site. Local builds and deploy previews skip this database step. Database credentials remain inside Netlify.

For a manual deployment outside Netlify, apply the focused, additive SQL change before using the switch:

```sh
cd web
npx prisma db execute --file prisma/site-appearance.sql --schema prisma/schema.prisma
npx prisma generate
```

Follow the repository's existing environment-loading instructions for DATABASE_URL and DIRECT_URL; the Prisma CLI does not automatically load `.env.local`. The normal web build also generates Prisma Client. Both web and bot schemas include the new table because they share the database. No existing data is removed by this addition.

New page loads receive the theme on the server, avoiding an initial theme flash. The root layout is dynamic so public HTML does not retain a previously selected theme. Open tabs poll the no-store public endpoint every 30 seconds, and also refresh on navigation, focus and return to a visible tab. Switching themes changes CSS and the presentation variants without resetting forms, conversations or the page's client state. API failures retain the current theme in open tabs; failed saves show an error and do not claim success.

Validation: `npm run test:theme` covers owner access, origin checks, invalid input, persistence in both directions and failure handling. Verify the public `/api/site-theme` endpoint after the production build to confirm live storage access.

## Immersive sci-fi effects

The Sci-fi theme includes CSS-animated SVG point-cloud waves, independently orbiting globe rings, a survey arc, drifting background stars, faint structural grids and particle textures on panels. These decorative layers do not accept pointer input or appear to screen readers. The Original theme hides them.

The Pause motion control saves a device-local motion preference. Animation pauses in hidden tabs, and system reduced-motion preferences disable it. Narrow screens hide the third wave layer and the secondary ambient cloud. Particle positions are deterministic; no per-particle animation loop or canvas runtime is used.

## Classic refinement

The Classic choice retains the stored `original` identifier, so existing settings continue to work. It uses self-hosted Inter Tight for large headings and keeps the existing body font. The landing page includes a labelled illustrative workspace, and the dashboard highlights the full toolkit alongside the signed-in user's three most recent creations. Structured outreach inputs are converted to readable titles. New accounts see an empty state instead of sample history. Classic styles are scoped to `data-theme="original"`; Sci-fi keeps its own typography and animation.

## Workspace navigation

Classic now exposes a full workspace header with the existing AI Tools, Community and Account menus, the existing API-backed notification control and a secondary toolbar for search and shortcuts. Credits come from the signed-in user record; no online-user, activity or health counters are fabricated. Tool search reads the existing tool registry, excludes entries marked Soon and shows upgrade links for locked tools. It supports Ctrl/Cmd+K, `/`, Escape and Enter. Public navigation provides a native product menu and direct links to the main product areas. Mobile navigation retains the existing native menu and a horizontally scrollable shortcut row.

Static previews render the same DashboardNav component as the application. Sample identity and credit values are labelled in the preview banner. Authentication actions and unread-count polling are not exercised in those static artifacts.
