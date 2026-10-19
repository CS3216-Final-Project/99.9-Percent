# Phone edition

The phone edition is a separate shell for phone-sized touch screens.
It plays the same store, simulation, saves and 3D room as the desktop edition, with a smaller scope and its own layout.
The desktop edition's code paths and rendering are unchanged by it.

## Scope

- Guided Mode: Chapter 0 (walkthrough), Opening, and Scaling & Routing.
- Challenge Mode (Classic): the full 26-week game, unlocked once the phone's Guided Mode is complete.
- Menu: run card, Resume, the few run controls a mode needs (How to play, Exit, Tutorial, New game), the mode switch, and the Sound and Graphics tabs.
- Home screen: the two mode cards and the anonymous analytics notice (OK / Opt out).
- Not on a phone: Account, sign-in and cloud saves, the Saves tab and save import/export, the avatar picker, the Playtest tab, Give feedback and observer notes, Save now (autosave still runs).

## The seam

| Piece | File | What it does |
| --- | --- | --- |
| Edition decision | `edition.ts` | `decideEdition`, `currentEdition`, `isPhoneEdition`. Decided once per page load. |
| React access | `editionContext.ts`, `EditionProvider.tsx` | `useEdition()`; the provider fixes it for a subtree (tests). |
| Shell choice | `../App.tsx` | Renders `Game` (desktop) or lazy-loads `PhoneApp`, so phone code and CSS never load on the desktop. |
| Scope | `../game/scope.ts` | `PlayScope`, `FULL_SCOPE`, `PHONE_SCOPE`, `scopeAllows`, `scopeComplete`. The store enforces it. |
| Shared lifecycle | `../components/useGameRuntime.ts` | Boot, sound, clocks, shortcuts, autosave, used by both shells. |

### Edition rule

Phone when the primary pointer is coarse and the screen's short side is at most 500 CSS pixels (`PHONE_MAX_SHORT_SIDE`).
Tablets, touch laptops and narrow desktop windows play the desktop edition with its responsive layout.
It reads the screen, not the window, so turning a phone or resizing a window never swaps the shell under a running game.
`?edition=phone` or `?edition=desktop` in the address overrides it, for development and browser tests.

### Scope enforcement

`useGame.getState().boot(PHONE_SCOPE)` stores the scope (the phone shell does this through `useGameRuntime`).
The store refuses chapter entries beyond `scope.lastChapter` with `scope.endOfGuided` as a toast.
The desktop chapter bar's Next button hides an entry the scope refuses.
When `scopeComplete` first holds, `commit` sets the existing permanent unlock `meta.challengeUnlocked`.
That unlock is per browser, so a desktop window in the same browser also finds Challenge Mode unlocked.
`challengeAvailable(state)` and `guidedScopeComplete(state)` in `game/store.ts` are the selectors for UI.
The finished chapter's dialog is replaced by `PhoneCampaignComplete`, which offers Challenge Mode.

## Styling

The phone shell sets `data-edition="phone"` on the app root and on `<html>` (for dialogs and tooltips outside the root).
Scope every phone rule to `[data-edition="phone"]` and keep it in `phone.css` or files imported from the phone shell.
Those files load with the phone chunk only, so they cannot affect the desktop edition.
Shared desktop CSS still applies inside the phone shell until a region overrides it.

## In-game regions

`PhoneGameLayout.tsx` composes the in-game screen from named regions.
A region renders no wrapper element, so its top element stays a direct child of `.app`, as the shared styles expect (for example `.app:has(> .chapter-zero-guide)`).
Each region currently renders the desktop components; replace a region's body without touching the others.

| Region | File | Renders today | Owner |
| --- | --- | --- | --- |
| Top strip | `regions/PhoneTopStrip.tsx` | `CampaignHeader` (with chapter bar) or `TopBar` | Teammate A: compact header strip |
| Room | `PhoneGameLayout.tsx` (`main.stage` with `Room`) | Shared 3D room | Shared; layout sizing by Teammate A |
| Sheet | `regions/PhoneSheet.tsx` | `CampaignPanel`, or `OperationsRail`, `SidePanel`, `ClassicViewSheet` | Teammate B: System metrics bottom sheet |
| Dock | `regions/PhoneDock.tsx` | `CampaignControls` or `BottomBar` | Teammate C: one-row dock and popovers |
| Coach | `regions/PhoneCoach.tsx` | `Tutorial` (Chapter 0 and guides) | Teammate D: Chapter 0 coach strip |
| Overlays | `PhoneOverlays.tsx`, `PhoneHome.tsx`, `PhoneMenu.tsx`, `PhoneCampaignComplete.tsx` | Phone home, menu, completion; shared dialogs | Foundation (this seam) |

Two shared components already ask the edition: `Tutorial.tsx` keeps its compact spotlight reach and `CampaignAction.tsx` keeps the purchase sheet on a phone in landscape.

## Tests

- `edition.test.ts`: the edition rule and override.
- `../game/scope.test.ts`: scope rules and the store's gating and unlock, with the real store.
- `PhoneApp.test.tsx`: the phone home screen, menu tabs and completion flow through `App`.
- Browser: `e2e/mobile.spec.ts` runs on Pixel 7, which is now the phone edition; see the coordinator's notes for the journeys that need moving to phone expectations or to `?edition=desktop`.
