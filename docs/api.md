# API

Base URL: `VITE_API_URL` (local: `http://localhost:3001`).
Request and response types live in [`shared/`](../shared). Change a type there only after both sides agree.

| Method | Path | Owner | Types | Status |
|---|---|---|---|---|
| GET | `/api/health` | Di Heng | `HealthResponse` (`shared/common.ts`) | Done |
| POST | `/api/dialogue` | Zi Yao | `DialogueRequest` → `DialogueResponse` (`shared/dialogue.ts`) | Stub |
| POST | `/api/missions/:id/report` | Zi Yao | → `MissionReport` (`shared/scores.ts`) | Planned |
| GET | `/api/progress` | Di Heng | TBD | Planned |
| GET | `/api/areas/:id/layout` | Di Heng | → `CityLayout` (`shared/cityLayout.ts`) | Planned |

## Handoff formats

- **Dialogue** (Zi Yao → Qi Jun): `shared/dialogue.ts`
- **Mission report** (Zi Yao → Qi Jun): `shared/scores.ts`
- **City layout** (Di Heng → Qi Jun): `shared/cityLayout.ts`. Units are metres, origin at the area centre.
- **3D assets** (Hai → Qi Jun): `.glb` in `frontend/public/models/`, 1 unit = 1 metre, snake_case names (e.g. `cafe_counter.glb`). Keep `.blend` files in Google Drive.
