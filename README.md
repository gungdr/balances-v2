# balances-v2

A snapshot-based personal-finance app for tracking household net worth without itemising every transaction.

The domain glossary lives in `CONTEXT.md`. The decisions behind the design and tech stack live in `docs/adr/`. The implementation outline lives in `docs/ROADMAP.md`.

## Local development

Prerequisites: Docker (OrbStack recommended on macOS), Go 1.22+, Node 20+.

```sh
cp .env.example .env
make up                # starts Postgres + Mailpit
```

Mailpit's web UI is at <http://localhost:8025> for inspecting dev emails.

Backend and frontend run instructions land as milestones M1.2 and M1.4 of the roadmap.
