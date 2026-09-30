# Debye: plasma physics learning app

Phase 0 and 1 of the plan in `../plans/plasma-app-plan.md`: a web app (installable PWA) that teaches
plasma physics from Chen, with live simulations, equation explainers, a plotter, spaced repetition,
streaks, badges and reminders.

## Run it

```bash
npm install
npm run dev        # local dev server
npm test           # physics benchmarks: every sim checked against its analytic result
npm run build      # static site in dist/, deployable anywhere (Vercel, Cloudflare Pages, GitHub Pages)
```

The build uses relative paths and hash routing, so `dist/` also drops straight into a Capacitor
Android shell (`npx cap add android`) when you want a Play Store app.

## What is in Phase 1

- Lessons A1 (Debye shielding, plasma frequency), A2 (gyration and drifts), A3 (μ, mirrors, loss cone)
- Simulations: Debye shielding (Metropolis Monte Carlo), plasma oscillation (1D electrostatic PIC),
  orbit sandbox (Boris pusher: E×B, ∇B, gravity drifts), magnetic mirror (single particle + 400-particle loss-cone test)
- Tap-a-symbol equation explainers, step-through derivations with a "try it first" mode
- Plotter with 9 presets: log/linear axes, pan, pinch/scroll zoom, crosshair readout
- 18 problems (numeric with tolerance, multiple choice, hints, worked solutions)
- 18 FSRS flashcards, XP and ranks, streaks with freezes, 11 badges, confetti and chimes
- Reminders: Google Calendar / .ics repeating alarm, in-app banner, browser notifications
- Concept map of the full A/B/C curriculum
- All progress stored on the device (localStorage)

## Layout

```
src/physics/     constants, Boris pusher, 1D PIC, Debye sampler, physics.test.ts
src/sims/        the four simulation components
src/components/  Eq (explainers), Plotter, Learning (derivations, problems, cards), Hud (theme widgets)
src/lessons/     A1–A3 content, plot presets, curriculum map, mastery rules
src/store/       state, XP/streaks/FSRS, badges, reminders
src/pages/       home, lesson, map, plot, review, badges, settings
```

Theme follows the SciFi template: navy HUD, scan lines, circuit traces, Exo + PT Sans, glow cyan.
