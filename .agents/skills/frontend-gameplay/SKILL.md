---
name: frontend-gameplay
description: Implement or review 99.99% gameplay controls, onboarding, scene interactions, responsive layout or React/Zustand lifecycle. Use for frontend product changes; use browser-e2e for authoring the browser tests themselves.
---

# Gameplay interface

Read the affected component and `frontend/src/game/store.ts`. Keep player decisions routed through the existing store actions and simulation; avoid computing a second set of game rules in the UI. Preserve the title/management/incident/review/ended transitions.

Choose verification by behavior:

- UI wiring or lifecycle: extend `frontend/src/App.test.tsx` or a focused component test with the real store. Only mock the WebGL facility where jsdom cannot render it.
- Persistence or transitions: add a focused case beside `frontend/src/game/`. Cover paused resume and corrupt/unavailable storage when relevant.
- Scene, tutorial, pointer/touch or layout: run the actual browser suite and extend a visible journey if behavior changed. Follow `browser-e2e`.

Timers must stop on pause, screen changes and unmount. Check StrictMode for duplicate initialization. Keyboard shortcuts must ignore typing fields and remove their listener on cleanup. Never make time advance while the title screen is showing.

Use named buttons and labeled regions/dialogs so controls work with assistive technology and tests. Verify a narrow touch viewport as well as desktop. Scene equipment labels are interactive DOM buttons associated with the 3D room; preserve their names and connection to selection/investigation.

For visual-only changes, inspect the relevant desktop and mobile states without inventing redundant unit tests. Explain any intentional gameplay change against the task; the proposal is planning context, not authorization to rewrite the current presentation.
