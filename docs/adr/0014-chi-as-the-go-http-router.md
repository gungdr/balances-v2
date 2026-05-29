# Chi as the Go HTTP router

The Go backend uses **`go-chi/chi`** as its HTTP router and middleware chain. Handlers stay
`http.Handler`-shaped so the broader stdlib ecosystem applies; Chi adds just enough ergonomics for
sub-routers, URL parameters, and middleware composition without becoming a framework that infects
every handler signature.

## Why Chi

For a personal-finance API with ~20–30 endpoints, the only ergonomic gaps in pure `net/http` are
middleware chaining and sub-router grouping. Chi closes both with a tiny dependency and no lock-in:

- **Stdlib-compatible.** Handlers are `http.Handler`; middleware is `func(http.Handler)
  http.Handler`. Ripping Chi out later would mean swapping the router and leaving every handler
  untouched.
- **Mature.** Released 2015, widely used, low rate of breaking changes — important for a project
  that may go months between active sessions.
- **Minimal surface.** Sub-routers (`r.Route("/households/{id}", ...)`), URL params, middleware
  chains. Nothing else.
- **Composable middleware.** Tenancy enforcement (ADR-0005) is naturally expressed as middleware
  that reads the authenticated user, derives `household_id`, and injects it into the request
  `context.Context` for downstream handlers and the repository layer.

## Considered alternatives

- **Pure `net/http` (Go 1.22+ `ServeMux`).** Viable runner-up. Pattern matching landed in 1.22 (`GET
  /users/{id}`), so basic routing is covered. Lost: sub-router grouping and middleware chains —
  you'd hand-roll both. Defensible if zero-dependency is a hard goal, but for a long-lived solo
  project the ergonomic delta favours Chi.
- **Gin.** Rejected — custom `gin.Context` type infects every handler signature with a
  framework-specific import. Migrating away later means rewriting handlers, not just swapping the
  router.
- **Echo.** Rejected — same `echo.Context` lock-in concern as Gin.
- **Fiber.** Rejected — built on `fasthttp` rather than `net/http`. Faster on synthetic benchmarks
  but incompatible with the stdlib middleware ecosystem; the speed gain is irrelevant at
  household-finance traffic levels.
- **Huma.** Considered — OpenAPI-first with struct-tag-driven validation and doc generation.
  Genuinely good for API-heavy products. Deferred — adds a layer we don't yet know we need, and it
  can be added on top of Chi later if API docs become a real concern.

## Consequences

- All handlers and middleware use stdlib `http.Handler` / `http.HandlerFunc` signatures.
- Tests exercise handlers via `httptest.NewRecorder` and `httptest.NewServer` with no
  framework-specific shims.
- Tenancy middleware reads the authenticated User from request context and injects `household_id`
  into a `context.Context` value; repositories pull it out via a helper rather than receiving it as
  a parameter.
- Adopting `huma` later for OpenAPI generation would layer on top of Chi without disturbing existing
  handlers.
- JSON validation will most likely use `go-playground/validator` against decoded request structs —
  independent of Chi.
