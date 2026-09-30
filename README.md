# Debye: plasma physics learning app

Phases 0 to 3 of the plan in `../plans/plasma-app-plan.md` (Track A complete): a web app (installable PWA) that teaches
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

## What is in the app

**Track A (Chen), lessons A1 to A11**, each with equation explainers, a step-through derivation,
at least one live simulation checked against its analytic result in `npm test`, plotter presets,
six problems and six flashcards.

**Learning engine (Phases 1 to 3 of the plan)**

- Spaced repetition with FSRS, plus a *personal memory curve*: after a dozen real reviews the app fits
  how long you hold cards compared with the FSRS average and shifts the schedule to hit your target recall.
- Learner model: per-concept mastery by Bayesian Knowledge Tracing over every answer (hints and peeks
  count as partial evidence), answer patterns (numeric vs multiple choice, hint rate, usual slips), and a
  small logistic-regression model trained on your own first attempts that predicts where you may struggle.
- Next-step suggestions with their reasons, a weekly digest (Home, plus a Sunday notification),
  study-rhythm analysis that suggests a reminder time, struggle detection on problems (two misses or
  ten minutes) and on idle simulations.
- AI tutor on claude.ai: Socratic help on a problem or questions about the lesson on screen, grounded in
  the learner model. Uses the viewer's own Claude account through the artifact `sample` capability and
  hides itself anywhere else.
- Cross-device sync on claude.ai through the artifact's private per-user store (`db` + `user`), with a
  merge that never loses progress (per-device counters, unions, newest record wins, resets propagate),
  and a copy-and-paste progress code for anywhere else.
- XP, ranks, streaks with freezes, 23 badges, confetti; reminders by calendar alarm, banner and notification.

## Tests

```bash
npm test                              # physics benchmarks + learner model, memory curve, sync merge
node scripts/smoke.mjs <port> A5      # one lesson in Chromium, desktop and phone, with screenshots
node scripts/smoke-app.mjs <port>     # app pages with a seeded learner, tutor mocked via ?mocktutor
node scripts/sync-test.mjs <port>     # two simulated devices sharing a mocked store
```

## Layout

```
src/physics/     numerical methods (pure TS) and their Vitest benchmarks
src/sims/        simulation components
src/components/  Eq (explainers), Plotter, Learning (derivations, problems, cards), Digest, Hud (theme widgets)
src/lessons/     A1–A11 content (auto-registered), plot presets, curriculum map, mastery rules
src/learner/     concept mastery (BKT), struggle predictor, personal memory curve, digest and suggestions
src/tutor/       AI tutor panel, prompt building, reply rendering
src/store/       state and event logs, XP/streaks/FSRS, badges, reminders, sync and merge
src/subject.ts   the subject-specific bits the learner model and tutor use
src/pages/       home, lesson, map, plot, review, you, settings
docs/            LESSON_GUIDE.md: how to add a lesson
```

Theme follows the SciFi template: navy HUD, scan lines, circuit traces, Exo + PT Sans, glow cyan.
