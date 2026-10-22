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
Replace a region's body without touching the others.

| Region | File | Renders today | Owner |
| --- | --- | --- | --- |
| Top strip | `regions/PhoneTopStrip.tsx`, `layout/PhoneChapterRow.tsx` | One row: logo (from 400 px), Cash, App Health or Health, Users and revenue behind one tap, sound, Menu; Guided Mode's one-line chapter row | Layout |
| Room | `PhoneGameLayout.tsx` (`main.stage` with `Room`) | Shared 3D room, filling the space between the top strip and the dock at a fixed size | Shared; layout sizing by Layout |
| Sheet | `regions/PhoneSheet.tsx`, `layout/sheetState.ts` | Bottom sheet over the room (peek, half, full) holding `CampaignPanel`, or `SidePanel` and `OperationsRail`; Challenge Mode's `ClassicViewSheet` | Layout |
| Dock | `regions/PhoneDock.tsx` | One row: views (or a Views menu), Navigation, clock, speed menu (with +1s and +5s in Guided Mode), Run/Pause or Next week | Layout |
| Coach | `regions/PhoneCoach.tsx`, `tutorial/` | One fixed-size coach strip above the dock for every guide: Chapter 0's lessons (`PhoneChapterZeroGuide`), chapter guides and tips | Tutorial |
| Overlays | `PhoneOverlays.tsx`, `PhoneHome.tsx`, `PhoneMenu.tsx`, `PhoneCampaignComplete.tsx` | Phone home, menu, completion; shared dialogs | Foundation (this seam) |

Two shared components already ask the edition: `Tutorial.tsx` keeps its compact spotlight reach and `CampaignAction.tsx` keeps the purchase sheet on a phone in landscape.

## Layout tokens and the sheet

`layout/phone-layout.css` holds the top strip, sheet and dock styles and sets these custom properties on the phone app root:

| Token | Meaning |
| --- | --- |
| `--phone-top` | The top strip's height, with the chapter row and the top safe-area inset. |
| `--phone-dock` | The dock's height, with the bottom safe-area inset. |
| `--phone-safe-bottom` | The bottom safe-area inset. |
| `--phone-sheet` | The sheet's current height; `--phone-sheet-peek` is its height at peek. |
| `--phone-room` | The height between the top strip and the dock, less `--phone-coach`. |

A guide sets `--phone-coach` on the root while its strip shows above the dock; the sheet stands above the strip.
The room's canvas never resizes with the sheet: the sheet, guides and menus open over it.

The sheet's state lives in `layout/sheetState.ts`: `useSheetState`, `getSheetState` and `setSheetState("peek" | "half" | "full")`.
An incident shows it at least half open (`shownSheetState`), and choosing equipment opens it from peek to half.
Its handle (`SHEET_HANDLE`, `.phone-sheet-handle`) is a button with `aria-expanded` that taps through the states, swipes, and takes Arrow Up/Down, Home and End.
A guide that restricts controls keeps that handle usable.

## Coach

Every guide on a phone docks in one coach strip directly above the dock, so the room and the lesson's real control stay in view.
`tutorial/phone-tutorial.css` fixes its height (`--phone-coach-height`) and sets `--phone-coach` on the app root while a strip shows.
`PhoneCoach` measures the dock and publishes its height as `--phone-coach-bottom` on `<html>`.

- Chapter 0 renders `PhoneChapterZeroGuide` through `Tutorial`'s `chapterZero` slot.
  It shares the lesson rules with the desktop card through `components/useChapterZeroLesson.ts`, so the exercises, spotlight, input boundary and saved progress are the same.
- The strip shows the lesson's section and progress, its title, a one-line task and Back, Learn more and Next (Finish), always in the same places.
- Learn more opens a non-modal reading layer with the reason, the labelled example and the longer explanation.
  It sits in the larger gap above or below the lesson's control, never over it or the top strip, and Escape closes it and returns focus to Learn more.
- Live readings stay in the real panel and top strip; the strip does not repeat them.
- `tutorial/phoneLessons.ts` holds each lesson's touch wording and how far it opens the sheet (`setSheetState`).
  While a guide shows, half never takes the room below 40% of the screen, except that the sheet keeps its header and one row of controls (or an inspection's readings) on screens under about 700 px tall.
- During Chapter 0 the chapter row is hidden (`--phone-chapter: 0`), as the desktop hides its chapter bar.
- Chapter guides and tips keep their card's content and dock it in the same strip; Skip and Next stay pinned while its text scrolls.
- The purchase quote (`confirmationRoomArea`) and the dock's menus keep clear of the strip.

## Tests

- `edition.test.ts`: the edition rule and override.
- `../game/scope.test.ts`: scope rules and the store's gating and unlock, with the real store.
- `PhoneApp.test.tsx`: the phone home screen, menu tabs and completion flow through `App`.
- Browser: `e2e/phoneLayout.spec.ts` covers the top strip, sheet and dock in both modes.
- Browser: `e2e/phoneTutorial.spec.ts` walks Chapter 0 by touch at 390x844, 360x640 and 320x568 and checks the coach strip, the room's share, each lit control and the reading layer, plus a replay and a chapter guide.
- Browser: `e2e/mobile.spec.ts` runs on Pixel 7, which is now the phone edition; see the coordinator's notes for the journeys that need moving to phone expectations or to `?edition=desktop`.
