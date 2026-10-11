# UI design for 99.99%

This guide records the current playable game's design. It applies to Campaign and Classic, including later phases. Gameplay rules may change; the shared visual language and interaction patterns should remain familiar. The proposal's future 2D direction is planning context and does not replace the current room or UI without a separate design decision.

## Visual language and reusable components

The isometric room is the main canvas. A dark purple HUD frames cream paper panels, outlined pixel icons and yellow primary actions. Use the tokens in `frontend/src/index.css` for colours, fonts, borders, radii, spacing and shadows. Pixelify Sans is the display face; Rubik is the body and numeric face. Numbers use tabular figures. Do not introduce a separate theme or a compressed text-only HUD for a new mode.

| Meaning / purpose | Existing pattern | Source |
| --- | --- | --- |
| Cash, users, revenue, health | `Stat` with a coloured `Concept` tile, label, headline and explanatory `Tip` | `components/ui.tsx`, `Game.tsx` |
| Advice / neutral evidence | Blue `Callout`, category label and short text | `components/ui.tsx` |
| Success / recovery | Green `Callout`, state tag or meter | `components/ui.tsx` |
| At risk / act soon | Orange warning; text and icon accompany colour | `components/ui.tsx`, `presentation.ts` |
| Active failure | Red incident icon, striped header and incident panel | `Game.tsx`, `IncidentPanel.tsx`, CSS `.is-incident` / `.incident` |
| Player-requested hint | Yellow hint callout; reserve yellow primary buttons for the next action | `components/ui.tsx` |
| Upgrade / response | `Act` or `.action` row: name first, then cost and activation delay badges | `components/ui.tsx`, `IncidentPanel.tsx` |
| Secondary evidence | Native `details.more`, rows and tables; exact values stay accessible | `SidePanel.tsx`, `CampaignUI.tsx` |
| Trends | Shared `LineChart`, labelled units, ticks and time axis | `Views.tsx` |
| Menu / report | Shared `Modal` with concept icon, body and footer actions | `components/ui.tsx`, `Modals.tsx` |
| Explanation on demand | Dark HUD tooltip with an arrow and a key for shortcuts. `Tip` wraps a term; `tipProps(text)` (or the `tip` prop on `Act`, `Callout`, `Chip`) marks a control. One `TooltipLayer` draws it. Never use the native `title` attribute | `components/ui.tsx`, `tips.ts`, `Tooltip.tsx` |
| Sound | Header mute beside Menu; the menu's Sound section with labelled Music and Sound effects sliders (percent shown) and Mute all, the same setting as the header | `SoundButton.tsx`, `SoundSettings.tsx` |
| Graphics | The menu's Graphics section: one radio card per quality (Auto, High, Medium, Low), each with a one-line account of what it changes. A chosen card is filled and outlined, not only coloured. The choice applies at once and is remembered in the browser | `GraphicsSettings.tsx`, `scene/quality.ts` |
| Tabs | A strip of buttons, the selected one dark, above a panel that holds only the selected tab's sections. `Tabs` supplies the tab roles, `aria-selected`, a single Tab stop and Arrow, Home and End keys. Tab names are one or two words with an icon | `components/ui.tsx`, `MenuTabs.tsx` |

Paths in this table are under `frontend/src/`. Shared vocabulary lives in `presentation.ts`: the same equipment gets the same name and icon in the room, investigation controls and inspector. Prefer extracting a shared primitive when extending an existing pattern to copying its markup or overriding its styles for one mode.

## Screen structure

- **Title:** room remains behind the overlay; show the title kicker, game name, short goal, three icon-led steps and a prominent Play/Continue button. Explain the current mode's loop and time units briefly. Do not carry Classic's 26-week target into Campaign.
- **Top bar:** brand and time at the left, four familiar metric tiles, then the sound mute and Menu. Health changes to the incident icon and the whole header gets the red striped treatment during an incident. Campaign pending revenue must be clearly distinguished from available cash and settled revenue.
- **Management:** room equipment is clickable. Selecting it gives immediate visible feedback with its name, icon and authoritative metrics. Campaign can keep a compact system overview visible because only a few opening actions exist.
- **Incident:** retain the red banner and symptom-focused title, a compact progress area, three impact tiles, then the numbered jobs **1. Inspect the evidence** and **2. Choose a response**. Equipment controls mirror the room. Selected equipment is highlighted and its latest observation is shown. Keep the permitted responses equally prominent; no full metrics table before the response list.
- **Bottom bar:** view tabs on the left; play/pause icon, selected speed and primary advance action on the right. Keep accessible names for icon-only buttons. Use labels that match the mode's actual time model.
- **Review:** report in a shared modal with outcome tag, time range, spending and evidence-based explanations. Raw snapshots belong in a disclosure. Continue returns to the same company.
- **History:** use shared charts with physical steps or weeks labelled accurately. Financial settlements and event details can use disclosures.
- **Menu:** the same five tabs, in the same order, in both modes: **Run, Sound, Graphics, Saves, Playtest**. Above the tabs stays what must be seen whichever tab is open: Classic's run card and Resume, Campaign's paused notice and any unreadable-save warning. Run holds the things done during play: Classic's Save now / How to play / Tutorial tiles, Campaign's how to play, Save now, introduction replay and save-and-exit, and in both the Game mode switch. Sound and Graphics hold the two shared preferences. Saves holds the save files (the pre-update save as a group inside it) and Campaign's account panel on the left, and Start over, in a red-bordered box because it replaces the run, on the right; from 760 px wide these are two columns, narrower screens stack them in that order. Playtest holds Classic's playtest data and Campaign's playtest export and observer notes. Only the selected tab's sections are in the page, so leaving a tab drops any half-finished confirmation or chosen file. Each section has an icon heading and stacked full-width actions; a confirmation appears beside the control that asked for it. Confirm replacement of saved progress and keep raw export available when a save cannot be read. After a bankrupt campaign the menu opens on Saves, where Export and New company are. Below 760 px the strip becomes two rows of icon-above-label tabs, so no label shrinks. The sound mute stays next to Menu in all modes and is the same setting as Mute all.
- **Menu type size:** the menu is read at arm's length, so its body text starts at 1 rem (notes and confirmations 1.05 rem), section headings 1.3 rem and buttons 1.15 rem, larger than the rest of the interface. Small uppercase labels are no smaller than 0.85 rem. Raise a menu text size before shrinking a layout to fit.
- **Graphics quality:** Auto, High, Medium and Low change only how the 3D room is drawn, never the interface, labels or game rules. Auto is the default and means High on a graphics card and the lightest settings when the browser draws on the CPU. High is HD materials, ambient shading, glow and soft 4096 shadows; Medium keeps HD materials and 2048 shadows but drops the glow and ambient pass and draws at the screen's normal pixel size; Low is the flat pixel look, no shadows, three quarters of the pixels and 30 frames a second. The profiles live in `scene/quality.ts`. A change starts a new canvas, which returns the camera to its starting view; say so in the menu.

## Phase 1 adaptations

Reuse the incident workspace, but use **Stable steps: n/5** and a stability meter instead of Classic's outage deadline. Explain the qualifying latency/error thresholds in the tooltip. Activation delays use physical steps. Inspection is free, immediate and repeatable; do not copy Classic's investigation timer or disable previously inspected equipment.

Show latency, service errors and total backlog as the compact symptom summary. Full system evidence must retain incoming/admitted/rejected demand; per-component demand, capacity, demand/capacity, busy utilisation, backlog, processed and failed counts; and installed versus routed server capacity. Keep finances separate from system evidence, with cash, pending revenue, unsettled costs and the next settlement boundary. Rejected opportunity value is forgone revenue, not an additional cash charge.

The UI reads the simulation snapshot and routes decisions through the store. It must not compute a second outcome, reveal a scripted root cause, recommend the matching fix, or restore weekly/timeout mechanics to make the layout look familiar. Costs, delays, unavailable actions and pending progress must reflect the existing rules. Use player-facing names such as “Database upgrade”, never internal IDs such as `upgrade-db`.

## Phase 4 data strategy

Keep the current campaign stage in the HUD while evidence scrolls. Detailed progression and next-stage prerequisites use a shared disclosure after the response workspace, so the opening incident's three responses remain visible. Continue to Data Strategy is explicit and leaves the company paused.

Reveal the Read Cache inspection chip and room label only after data entry. They select the same component through the existing dispatcher. The request path includes optional Read Cache; nearby evidence explains that eligible misses, writes and non-cacheable reads still reach the database. A cache is not an independent queue or failure source.

Until actual workload growth, show “Waiting for workload growth.” Once applied, show the observed profile/mix, rate used, hits, misses and DB pressure in a compact callout. Keep logical operations, warmth used/after, read/write demand and historical details in disclosures. History with no data observations says the detail was not recorded. Cache/tuning use the same action rows and cost/delay badges as other investments; unavailable database tiers do not advertise a locked purchase.

## Responsive and accessible behaviour

Use the existing desktop side panel and mobile bottom panel. At 900 px and below, the header wraps, metric tiles reduce to icon/headline pairs, view tabs become icons and the speed selector hides. The room stays usable above the mobile panel. Evidence tables may scroll inside their disclosure; the page must not overflow horizontally. Do not make tables or explanatory paragraphs push every decision far below the initial viewport.

At desktop size, verify all three opening responses fit in the initial incident panel. On mobile, scrolling within the panel is expected; verify equipment selection, each response, detailed evidence, pause, history and Menu remain reachable by touch. Expanded evidence must not cover the footer. Keep tap targets consistent with the existing buttons, visible focus, named controls, `aria-pressed` on selection/toggles, labelled charts and progress bars, and status announcements for inspection and pending actions. Do not rely on colour alone. Preserve reduced-motion styling. Tooltips open on hover (after a short pause) and on keyboard focus, close on Escape, and explain locked controls too. On touch a tap on a term opens its tooltip; tapping a button only acts.

## Review before changing UI

Compare the result with the current committed game's UI and this guide, not only with a standalone mockup. Existing visual references are in [the prototype migration notes](prototype-migration.md); source components and current browser renders are the maintained baseline.

Inspect title, healthy management, active incident, selected equipment, pending response, recovery report, history and Menu on desktop (1440 × 900) and a narrow touch viewport (about 390 px wide). Also check an unavailable action and long/large values. Confirm that warnings, control order, icon meanings and selected states remain familiar, exact evidence remains available, and actions have not gained or lost gameplay effects.

Follow [testing.md](testing.md) for static checks and the real WebGL browser suite. Extend a browser journey for changed selection, disclosure or action behaviour; take screenshots for visual inspection. Passing tests establish wiring and reachability, not visual consistency by themselves. Include any intentional design departure and its gameplay reason in the PR description, and update this guide when that departure is approved.
