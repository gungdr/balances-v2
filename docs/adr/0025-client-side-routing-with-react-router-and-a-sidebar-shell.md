# Client-side routing with React Router and a sidebar shell

Navigation moves from **in-component state** (nested shadcn `Tabs` driven by `useState` in `App.tsx`)
to **URL-addressable routes** under **React Router v7**, and the navigation chrome moves from a
horizontal tab bar to a **shadcn Sidebar** — a persistent sidebar on desktop, a hamburger-opened
drawer on phones. This delivers [[adr-0015]]'s deferred router (the M4.9 backlog item) and fixes a
concrete mobile defect: seven top-level tabs plus nested subtype tabs overflowed the viewport and
were unusable on a phone.

## Why now

The pre-router nav had three problems that compounded as the app grew to ten position groups:

- **No deep-linking, no refresh, no back button.** The entire hierarchy lived in React state, so
  every screen was the same URL (`/`). A refresh dropped you on the dashboard; the browser back
  button left the app; nothing was bookmarkable or shareable. E2E specs had to replay
  `goto('/') → click tab → click tab` to reach any screen.
- **The tab bar overflowed on mobile.** Seven top-level tabs (Dashboard, Assets, Liabilities,
  Receivables, Investments, Income, Settings) plus a second nested row (Investments alone has five
  subtypes) do not fit a phone. The app's audience is non-technical household members on phones, so
  this was a real usability failure, not a cosmetic one.
- **`App.tsx` was a 300-line nested-`Tabs` tree** carrying four pieces of selection state and a
  hand-rolled detail-page overlay — the structure a router exists to own.

## The decision

### React Router, not TanStack Router

React Router v7 was chosen over TanStack Router despite the latter being ecosystem-coherent with the
TanStack Query already in use ([[adr-0015]]). The deciding factors: React Router is the more stable,
far more widely documented option, its nested-layout-route model maps directly onto a sidebar shell +
group/subtype/detail hierarchy, and it is the choice [[adr-0015]] already named. TanStack Router's
real advantage is compile-time-checked params and links; we recover most of that benefit with a
**centralised `src/lib/routes.ts`** of path constants and builders (`routes.bankAccount(id)`) that
every route definition, sidebar item, list-row `onSelect`, and detail back-link references — so a
renamed path is one edit and a mistyped link is a TypeScript error, not a runtime 404. The remaining
gap (a builder whose output doesn't match its route's `path` string) is not worth a newer, smaller-
community router for a solo-maintained pre-alpha app.

### URL scheme mirrors the domain hierarchy

```
/                                Dashboard
/assets                          Assets home (placeholder)
/assets/bank-accounts[/:id]      list / detail
/assets/properties[/:id]
/assets/vehicles[/:id]
/liabilities                     Liabilities home (placeholder)
/liabilities/personal[/:id]
/liabilities/institutional[/:id]
/receivables[/:id]
/investments                     Investments home (placeholder)
/investments/{stocks,mutual-funds,bonds,time-deposits,gold}[/:id]
/income
/settings
```

Three deliberate shape decisions:

- **Group home pages for subtyped groups only.** Assets, Liabilities, and Investments get a real
  `/<group>` landing page (currently a placeholder) rather than a redirect to their first subtype,
  because each will grow a cross-subtype group dashboard. The flat groups — Receivables (no subtypes)
  and Income (a flow event, not a position group, per [[adr-0003]]) — keep their list at the root
  path; a future dashboard there can render above the list with no route change.
- **Liability detail nests under its subtype** (`/liabilities/personal/:id`), unlike the shared
  detail component and table behind it. The alternative — a flat `/liabilities/:id` alongside the
  literal `/liabilities/personal` and `/liabilities/institutional` lists — works only by relying on
  React Router ranking literal segments above the dynamic `:id`. Nesting removes that implicit
  overlap and makes liabilities symmetric with the other groups. The subtype in a detail URL is
  cosmetic (the component fetches by id and ignores it), but it is always known at navigation time.
- **The default catch-all redirects to the dashboard**, so an unknown path never dead-ends.

### Screens stay router-unaware; a thin bridge wires them

The ~20 list and detail components predate the router and take a callback contract — `onSelect(id)` /
`onBack()` plus the entity id as a prop. Rather than rewrite all of them to call `useNavigate` /
`useParams`, two thin wrappers in `App.tsx` (`ListRoute`, `DetailRoute`) bridge that contract to the
router: `ListRoute` hands a screen a navigate function, `DetailRoute` also pulls the `:id` param. The
router lives only in `App.tsx`; the screens are untouched. This kept the migration's blast radius to
`App.tsx`, `AppShell.tsx`, a new `AppSidebar.tsx`, `routes.ts`, three placeholder home pages, and the
E2E entry-navigation.

### The shell: shadcn Sidebar

`AppShell` becomes a `SidebarProvider` + `AppSidebar` + `SidebarInset` with the routed page in an
`<Outlet/>`. The sidebar is **always visible on desktop and a `Sheet` drawer on phones** (shadcn's
built-in responsive behaviour, keyed off a `use-mobile` hook). Subtype sub-items render **always
expanded** beneath their group — few enough that a collapse would only add a click. Active state is
by path prefix (a leaf stays highlighted on its detail pages); a group's own home link highlights
only on its exact path. The user avatar and sign-out **stay in the top header**, always visible,
rather than moving into the sidebar — clearer for non-technical users, and the sign-out path is
unchanged.

## Considered alternatives

- **TanStack Router.** Ecosystem-coherent and type-safe, but newer/smaller and a deviation from the
  named plan; the `routes.ts` convention recovers most of the link-safety. Rejected for this app's
  stability/docs needs. (See "React Router, not TanStack Router.")
- **Keep tabs, scroll horizontally on mobile.** Smallest change, but off-screen tabs are
  undiscoverable and the chrome stays visually busy. Rejected — it papers over the overflow.
- **Bottom tab bar on mobile.** App-like, but a bottom bar tops out at ~5 destinations; we have
  seven top-level groups, forcing a consolidation we didn't want. Rejected.
- **Hamburger-only menu on every breakpoint.** Hides navigation behind a tap even on desktop, where
  there's room to show it. Rejected in favour of a persistent desktop sidebar.

## Consequences

- **Dependencies.** `react-router` v7 added. `shadcn add sidebar` pulled `sidebar`, `sheet`,
  `tooltip`, `separator`, `skeleton` UI primitives and a `use-mobile` hook. The hook's default
  (`useEffect` + `setState`) was rewritten with `useSyncExternalStore` to satisfy the repo's
  `react-hooks/set-state-in-effect` rule without an eslint-disable.
- **`routes.ts` is the link-safety convention.** New routes add a constant/builder there; navigation
  references it rather than a literal path. This is the deliberate stand-in for a type-safe router.
- **Group home placeholders exist to be fleshed out.** `AssetsHome`, `LiabilitiesHome`,
  `InvestmentsHome` are stubs today; the planned per-group dashboards land in them without route
  changes.
- **E2E got simpler.** Specs `goto('/assets/properties')` directly instead of replaying tab clicks;
  mid-test navigation that must avoid a reload (e.g. `rebuild.spec` exercising client-side `['reports']`
  invalidation) clicks persistent sidebar links instead. All 14 specs pass unchanged in intent.
- **Production needs SPA history fallback.** Deep links and refresh require the static server to
  serve `index.html` for unknown non-`/api` paths. Vite's dev server and `vite preview` already do
  this (so dev and E2E work); the production host must be configured the same way — a checklist item
  for the deploy milestone ([[adr-0013]]).
- **`App.tsx` shrank** from a nested-`Tabs` state machine to a router config plus an auth gate;
  selection state and the detail-overlay branch are gone.
