# Debye: plasma physics learning app

Phases 0 to 3 of the plan in `../plans/plasma-app-plan.md` (Tracks A and B), plus the predictive gap filling of
Phase 4: a web app (installable PWA) that teaches plasma physics from Chen and laser–plasma interactions from Kruer,
with live simulations, equation explainers, a plotter, spaced repetition, streaks, badges and reminders.

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

**Track B (Kruer), lessons B1 to B9**, laser–plasma interactions in the same format, with the practical laser
units (W/cm², µm, cm⁻³, keV) next to SI: light in a density gradient and the critical density (B1), collisional
absorption by inverse bremsstrahlung (B2), resonance absorption (B3), the ponderomotive force (B4), parametric
instabilities (B5), stimulated Raman and Brillouin scattering (B6), two-plasmon decay and filamentation (B7),
hot electrons (B8) and the simulation methods of the field (B9). Its sixteen simulations, each checked against
its analytic result in `npm test`: rays in a density ramp and the full-wave Airy standing wave at the turning point
(B1); full-wave collisional absorption in a ramp, with the Langdon effect (B2); the resonance-absorption angle sweep
that rebuilds the Denisov curve (B3); electrons leaving a focal spot under the full Lorentz force, and profile
steepening by the light (B4); pumped coupled oscillators and a wave-matching triangle builder (B5); a growth-rate map
of SRS and SBS and a three-wave amplifier with pump depletion (B6); two-plasmon decay in k-space, and beam breakup
by filamentation and self-focusing (B7); electrons surfing a plasma wave, and a hot-tail distribution with its
bremsstrahlung slope (B8); sanity checks for a PIC code, and a 1D electromagnetic PIC run of stimulated Raman
scattering (B9). It builds on A5, A6, A9 and A10 (the map draws the direct links from A6, A9 and A10). Track C
(Gibbon: short-pulse and relativistic plasmas) is on the map as the next phase.

**Learning engine (Phases 1 to 3 of the plan, and the start of Phase 4)**

- Spaced repetition with FSRS, plus a *personal memory curve*: after a dozen real reviews the app fits
  how long you hold cards compared with the FSRS average and shifts the schedule to hit your target recall.
- Learner model: per-concept mastery by Bayesian Knowledge Tracing over every answer (hints and peeks
  count as partial evidence), answer patterns (numeric vs multiple choice, hint rate, usual slips), and a
  small logistic-regression model trained on your own first attempts that predicts where you may struggle.
- Prep check (Phase 4, predictive gap filling): when you open a lesson, the app looks back at the lessons it
  builds on. If you mastered them but the learner model still rates some of their ideas weak or shaky, a small
  *Refresh before you start* note lists up to three, each linked to its problems. It stays quiet without
  evidence, and once you start the lesson.
- Next-step suggestions with their reasons, a weekly digest (Home, plus a Sunday notification),
  study-rhythm analysis that suggests a reminder time, struggle detection on problems (two misses or
  ten minutes) and on idle simulations.
- AI tutor: Socratic help on a problem or questions about the lesson on screen, grounded in the learner
  model. On claude.ai it uses the viewer's own Claude account through the artifact `sample` capability;
  anywhere else it can use a model running on your own machine (see *Use a local model*), and it hides
  itself when neither is available.
- Cross-device sync on claude.ai through the artifact's private per-user store (`db` + `user`), with a
  merge that never loses progress (per-device counters, unions, newest record wins, resets propagate),
  and a copy-and-paste progress code for anywhere else.
- XP, ranks, streaks with freezes, 33 badges (one per lesson and one per finished track among them), confetti;
  reminders by calendar alarm, banner and notification.

## Use a local model

The tutor can answer with a model on your own computer instead of Claude: Ollama, LM Studio, llama.cpp's
`llama-server`, Jan, or any OpenAI-compatible server. With a server of your own, your questions stay with it.
On claude.ai only Claude is available, because the artifact sandbox does not let the page reach other hosts
(localhost included), so run Debye yourself:

```bash
npm install
npm run local      # builds, then serves the app on http://localhost:4173
```

Then start a model server and pick it in the **Tutor model** card of the **Remind** tab (⏰, also linked from
You → Reminders and settings, and from *Model settings* in the tutor panel): Find models, then Test.

- **Ollama**: install it from ollama.com, `ollama pull qwen2.5:7b`, and keep the app open (or `ollama serve`).
  Pages on localhost are allowed by default; any other page address needs `OLLAMA_ORIGINS` (see below).
- **LM Studio**: load a model, start the server in the Developer tab (port 1234) and turn on *Enable CORS*.
- **llama.cpp**: `llama-server -m model.gguf -c 8192 --port 8080` (browser requests are allowed by default).
- **Jan**: in Settings → Local API Server, set an API key (paste it into Debye too), keep CORS on and start
  the server (port 1337).

**On your phone, same Wi-Fi.** On the computer, serve Debye on the network and let the model server listen
there too, then open `http://<computer-ip>:4173` on the phone and use `http://<computer-ip>:11434` as the address:

```bash
npm run local -- --host
# quit the Ollama app (or stop its service) first: `ollama serve` cannot start while it runs,
# and the app ignores variables set in a shell
OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=http://<computer-ip>:4173 ollama serve
```

To keep using the Ollama app instead, give it the variables and restart it: on macOS
`launchctl setenv OLLAMA_HOST 0.0.0.0` and `launchctl setenv OLLAMA_ORIGINS http://<computer-ip>:4173`; on
Windows add both as user environment variables (Settings → Edit environment variables for your account); on
Linux run `sudo systemctl edit ollama` and add them as `Environment=` lines under `[Service]`.

(LM Studio: also turn on *Serve on Local Network*; llama.cpp: add `--host 0.0.0.0`; Jan: set the host to
0.0.0.0 and add the computer's IP to *Trusted Hosts*.) The model choice and any API key stay on the device:
they are never synced or put in a progress code. A page served over https cannot call a plain-http model on
another machine, so use the http address above.

For development, `node scripts/mock-llm.mjs 11434` fakes both Ollama and an OpenAI-compatible server
(`--think`, `--slow`, `--missing`, `--no-cors`, `--cut` switch on the awkward cases).

## Tests

```bash
npm test                              # physics benchmarks + learner model, memory curve, sync merge, local model streams
node scripts/smoke.mjs <port> A5      # one lesson in Chromium, desktop and phone, with screenshots
node scripts/smoke-app.mjs <port>     # app pages with a seeded learner, track structure, map fit, prep check, tutor mocked via ?mocktutor
node scripts/sync-test.mjs <port>     # two simulated devices sharing a mocked store
```

## Layout

```
src/physics/     numerical methods (pure TS) and their Vitest benchmarks
src/sims/        simulation components
src/components/  Eq (explainers), Plotter, Learning (derivations, problems, cards), Digest, Hud (theme widgets)
src/lessons/     A1–A11 and B1–B9 content (auto-registered), plot presets, curriculum and tracks, mastery rules
src/learner/     concept mastery (BKT), struggle predictor, personal memory curve, digest and suggestions, prep check
src/tutor/       AI tutor panel, prompt building, reply rendering, local model clients and settings
src/store/       state and event logs, XP/streaks/FSRS, badges, reminders, sync and merge
src/subject.ts   the subject-specific bits the learner model and tutor use
src/pages/       home, lesson, map, plot, review, you, settings
docs/            LESSON_GUIDE.md: how to add a lesson
```

Theme follows the SciFi template: navy HUD, scan lines, circuit traces, Exo + PT Sans, glow cyan.
