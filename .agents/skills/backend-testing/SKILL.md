---
name: backend-testing
description: Implement or verify Express API behavior, shared request/response contracts, health routes, error handling or browser CORS in the retained backend. Use for backend route and HTTP test work, excluding database migration authoring.
---

# API verification

Read the route, `backend/src/app.ts`, `shared/` types and relevant `backend/test/` cases. The current backend retains health and dialogue endpoints; there is no server-backed tycoon save endpoint. Do not claim browser gameplay is integrated with the API.

Use Supertest against the Express app without opening a port. Test successful response shape and meaningful invalid input/error paths. Avoid live service credentials or cloud data in unit/integration tests. For database schema behavior use the existing PGlite migration harness; for service failures mock the dependency boundary, not the entire route.

CORS must be tested at HTTP level: an allowed origin receives the exact `Access-Control-Allow-Origin`, a denied origin receives none, and JSON POST preflight permits the requested method/headers. A health response with status 200 does not prove browser access. Cover production and preview patterns, including lookalike hosts.

Environment-dependent middleware is initialized when the app is imported. Stub variables before a dynamic import after `vi.resetModules()`; restore variables afterwards. Keep fixtures independent and clean up temporary state even on failure.

From `backend/` run `npm run lint`, `npm run typecheck` and `npm run test:coverage`. Review coverage for the changed paths and explain untested integrations. Preserve deployment/CORS/database settings unless the task explicitly changes them. Follow `database-migrations` for schema changes.
