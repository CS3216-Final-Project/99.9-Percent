---
name: release-check
description: Diagnose 99.99% CI failures, prepare a validated pull request, or verify an authorized deployment and frontend/backend domain configuration. Use for PR readiness and release checks; invoking this skill alone does not authorize merging or deploying.
---

# PR and release verification

Read `.github/workflows/ci.yml`, `.github/workflows/cd.yml` and the README deployment section. Preserve the required `frontend` and `backend` job names. Browser journeys are part of the required frontend job.

For a PR, inspect the final diff and run the relevant local checks in `docs/testing.md`. Confirm package manifests and locks agree, generated outputs are ignored, and no secrets or unrelated backend changes appear. State what changed, why, what was verified and what remains unverified. Create the PR when requested and inspect CI on the exact pushed commit; do not report an earlier run as current.

On failed CI, read the failing step and attached coverage/browser artifacts. Reproduce the smallest failing case. Fix the root cause before expanding verification; do not disable a check or update an expected outcome without explaining the changed behavior.

For an authorized deployment check:

- Frontend production domain: `https://99-99-percent-web.vercel.app`.
- Backend production domain: `https://99-99-percent-backend.vercel.app`.
- Check health and database health, then send an HTTP request with the frontend Origin and inspect CORS headers. Health alone cannot verify browser access.
- Verify public frontend `VITE_API_URL` and backend `CORS_ORIGINS` match the intended environment. Preview host patterns follow the Vercel project name. Changing docs or a custom domain does not update hosted environment variables; those settings need redeployment.

Use read-only checks unless the user's scope authorizes a mutation. Do not infer permission to merge, change branch protection, deploy or run live migrations from a request to create a PR. Report inaccessible hosted settings honestly.
