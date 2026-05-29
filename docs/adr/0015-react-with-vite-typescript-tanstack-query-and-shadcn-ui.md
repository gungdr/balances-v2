# React with Vite, TypeScript, TanStack Query, and shadcn/ui

The web frontend is built with **React + TypeScript**, bundled by **Vite**, with **TanStack Query**
for server state and **shadcn/ui** + **Tailwind CSS** for components and styling. Routing, form
libraries, and chart libraries are deferred until frontend work begins.

## Why this stack

The original brief proposed Vue. The flip to React is driven by reasons specific to the user and the
project:

- **AI assistance depth.** The user is a backend engineer with near-zero frontend experience and
  intends to lean heavily on AI assistance for UI work. AI tools (Claude, Cursor, Copilot) have
  substantially more training data on React than on Vue. The productivity delta compounds over
  months of solo development.
- **shadcn/ui** suits a finance-dashboard aesthetic and the "own your components" model: components
  are copied into the repo, not installed as a black-box package, and remain freely tweakable. Pairs
  natively with Tailwind CSS and Radix UI primitives.
- **TanStack Query** maps cleanly to the materialized-report staleness model (ADR-0006). Server
  state with TTL, background refetch on focus, and optimistic updates are first-class. The mental
  model "the client cache mirrors server-state with staleness" is exactly the design we already
  chose server-side.
- **Vite + TypeScript** is the de-facto default for new React apps now: fast HMR, simple config,
  native ESM, strong TS support out of the box.
- **React Native option preserved.** If Q21 (mobile strategy) lands on a code-sharing native
  approach later, React Native is the only credible path. Picking React now keeps that door open
  without forcing a decision today.

## Considered alternatives

- **Vue 3 (Composition API + Vite).** The original brief's pick. Excellent framework, smaller
  learning curve, single-file components are clean. Rejected for this project because the
  AI-assistance gap is real and material for a backend engineer leaning on AI for nearly all UI
  work, and because NativeScript-Vue is far less mature than React Native if mobile ever turns
  native.
- **Svelte 5 / SolidJS.** Excellent DX and smaller bundle sizes, but niche ecosystems and weaker AI
  training data make them poor fits for a long-lived solo project where AI assistance is
  load-bearing.
- **Next.js.** Considered. Rejected for now — server components add deployment complexity and
  conceptual surface area we don't need for a single-Household-scale app. A Vite + React SPA is
  simpler, deploys as static files to any CDN, and pairs cleanly with the Go backend over plain
  HTTP. Reconsider if SSR becomes a real need.
- **MUI / Mantine / Chakra** instead of shadcn/ui. All workable. shadcn/ui wins for the "components
  live in your repo, not behind an npm package" property — better long-term ergonomics for a project
  that may sit untouched for months.

## Deferred frontend decisions (not blocking)

These will be decided when frontend work starts, not now:

- **Routing**: React Router vs TanStack Router. TanStack Router has better TypeScript integration
  and pairs naturally with TanStack Query; React Router is the safe default.
- **Forms**: React Hook Form (likely) + Zod for validation (likely).
- **Charts**: Recharts (most popular React chart library) vs visx vs Tremor (built on Recharts,
  dashboard-specific). Probably Tremor or Recharts.
- **Client-only state**: Zustand or Jotai if anything beyond TanStack Query is needed. Most app
  state should live in server state via TanStack Query; client-only state should be small.

## Consequences

- Tailwind CSS is part of the stack by virtue of shadcn/ui. PostCSS pipeline configured in Vite.
- The frontend ships as static files (HTML + JS + CSS bundle) and can be served by any CDN or even
  by the Go backend itself if desired.
- The Go backend exposes a JSON API; the frontend consumes it via TanStack Query. No SSR coupling.
- React Native remains a future option for native mobile without rearchitecture.
- The user's near-zero frontend skill profile means frontend tasks expect substantially more
  complete output from AI assistance — generate runnable components, explain decisions, don't assume
  React idioms are known.
