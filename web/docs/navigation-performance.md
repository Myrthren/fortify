# Workspace navigation performance

The dashboard header now lives in the authenticated dashboard layout. Tool
pages send only fresh navigation fields through `WorkspaceMemberSync`; they
retain their own authentication, ownership and feature checks. The shell keeps
menus, search, notification polling, business controls and the opened assistant
mounted between tools. Owner visibility is resolved on the server.

`dashboardSession` and `currentUser` use React request-local caching. Member
data is never placed in Next's cross-request Data Cache. Shared theme and
announcement reads use separate 30-second tagged caches; owner mutations
invalidate the corresponding tag after a successful database write. Announcement
expiry is filtered on every read, and stored cache values use ISO date strings.
Open dashboards refresh announcements every 30 seconds while visible.

The root layout no longer forces all public pages to render on every request.
Public pages can revalidate every 30 seconds. Authenticated routes and their API
checks remain dynamic. Theme polling runs once per tab instead of restarting on
every navigation; the owner-save event still applies an immediate update.

## Loading and resources

- The full chat component is imported only when the launcher is clicked. Its
  state survives dashboard navigation after opening, and failed imports offer
  a retry. Assistant links to Fortify use client navigation.
- Menu, search, shortcut and directory links prefetch their loading boundary on
  hover or keyboard focus. Data Saver and 2G connections suppress this warming.
  Pending links show immediate feedback. No full-route prefetch is forced.
- The shared header stays outside page loading boundaries. The busiest tools
  have named loading states; other routes use the common workspace placeholder.
- The dashboard heading and business setup entry stream before the activity
  snapshot's database queries finish.
- Planning, Simulation Lab and business setup styles load with their own route
  layouts. Dashboard styles are no longer part of public-page resources.
- Global ambient SVG circles fall from 864 to 288. The operating shell uses a
  static star field and hides the global SVG fields. Touch devices, Data Saver
  and devices reporting four or fewer CPU cores receive reduced global effects.
  Hero illustrations and explicit Simulation Lab rendering retain their existing
  behaviour. Reduced-motion and hidden-tab handling remain in place.
- File tracing is scoped to `web/`, avoiding unrelated ancestor lockfiles and
  checkout folders during local builds.

## Verification and measurement

Run `npm run test:navigation`, the existing workspace/content/business/plans
regressions, `npx tsc --noEmit`, and a production build. The navigation suite
covers route selection, safe member serialization, announcement expiry,
authentication and cache invalidation. The appearance suite covers owner access,
origins, failed reads/writes, cache reuse and immediate invalidation.

An initial local bundle comparison against the cached pre-change production
build found:

| Resources | Before | After |
| --- | ---: | ---: |
| Public shared CSS, minified | 235,690 B | 99,808 B |
| Ordinary dashboard CSS, minified | 235,690 B | 154,757 B |
| Ordinary dashboard CSS, separately gzipped files | 42,023 B | 28,666 B |
| Dashboard initial JavaScript, separately gzipped files | 208,130 B | 215,279 B |

The persistent client navigation adds about 7 KB compressed JavaScript net of
chat deferral. These are local build artifact sizes, including shared framework
resources, not a controlled production timing benchmark. Tool-specific layout
assets must also be included when assessing Plans or Simulation Lab payloads.

Browser verification uses a separate, local Next.js fixture with the actual
navigation/chat components and sample endpoints. It does not bypass production
authentication or write member records. Live signed-in navigation latency,
database/hosting region effects, mobile INP and Core Web Vitals still require
measurement after deployment; no millisecond improvement is claimed here.
