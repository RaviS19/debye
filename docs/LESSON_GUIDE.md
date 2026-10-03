# How to build a lesson for Debye

Read this whole file, then read these reference files before writing anything:
`src/lessons/A1.tsx`, `src/lessons/A3.tsx`, `src/lessons/types.ts`, `src/lessons/plots.ts`,
`src/components/Eq.tsx`, `src/components/Learning.tsx`, `src/components/Plotter.tsx` (types at the top),
`src/components/useCanvas.ts`, `src/sims/SimFrame.tsx`, `src/sims/MirrorSim.tsx`, `src/sims/PlasmaOscSim.tsx`,
`src/physics/pic1d.ts`, `src/physics/boris.ts`, `src/physics/constants.ts`, `src/physics/physics.test.ts`.
For a Track B or C lesson, also read the earlier lessons it builds on (its `prereqs` in `src/lessons/index.ts`, and any
Track A lesson that already touches the topic) so you cross-reference them and never duplicate one of their sims or plot presets.

The app is a Vite + React 19 + TypeScript static site. Theme: dark navy HUD, glowing cyan
(`src/theme.css`). Lessons, plots and sims follow the patterns in A1–A3 exactly.

## Files you may create (and nothing else)

Lesson ids are a track letter and a number: `L1`–`L3` (laser physics trial: Silfvast, Keller, Weiner), `A1`–`A11` (Chen), `B1`–`B9` (Kruer), `C1`–`C8` (Gibbon).
Below, `<L>` stands for your lesson id (for example `B3`).

| File | Contents |
|---|---|
| `src/lessons/<L>.tsx` | `export const <L>: Lesson = {...}` (auto-registered by filename glob) |
| `src/lessons/plots-<L>.ts` | `export const PLOTS: PlotSpec[] = [...]` (auto-merged into the plotter) |
| `src/sims/<Name>Sim.tsx` | one file per simulation component |
| `src/physics/<name>.ts` | pure numerical code, no DOM, no React |
| `src/physics/<name>.test.ts` | Vitest benchmarks for that physics code |

Never edit any existing file. If you need a helper that almost exists, copy it into your own file.
Import freely from existing modules (`pic1d`, `boris`, `constants`, `Eq`, `Plotter`, `Learning`, `SimFrame`, `useCanvas`).

## Work in a private copy

Other people build other lessons at the same time. A half-written file of theirs must not break your
build, and yours must not break theirs. So:

```bash
WT=/home/claude/wt-<your-label>
rm -rf $WT && mkdir -p $WT && cd /home/claude/debye && \
  tar --exclude=node_modules --exclude=dist --exclude=.git -cf - . | tar -xf - -C $WT && \
  ln -s /home/claude/plasma-app/node_modules $WT/node_modules
cd $WT
```

Work and test only in `$WT`. When everything passes, copy **only your own files** back into
`/home/claude/debye/` (the main repo) at the same paths. Then delete `$WT`. Never run git commands.

## Lesson object (see `types.ts`)

- `id: '<L>'`, `title` (match the curriculum title in `src/lessons/index.ts` MODULES), `subtitle`, `minutes` (40–60).
- `refs`: the first entry is the track's book with the chapter number, and section numbers **only if you
  are certain of them**; otherwise cite the chapter by topic.
  - Track A: Chen, *Introduction to Plasma Physics and Controlled Fusion* (3rd ed.). Companions: Bellan
    *Fundamentals of Plasma Physics*; Goldston & Rutherford *Introduction to Plasma Physics*; Fitzpatrick's
    open lecture notes; Stix; Krall & Trivelpiece; Freidberg *Plasma Physics and Fusion Energy*; Wesson *Tokamaks*.
  - Track B: Kruer, *The Physics of Laser Plasma Interactions* (Addison-Wesley 1988; Westview reprint 2003).
    Its chapters (verified table of contents): 1 Basic concepts and two-fluid description; 2 Computer
    simulation of plasmas using particle codes; 3 Electromagnetic wave propagation in plasmas (3.2 WKB,
    3.3 constant density gradient / Airy); 4 Obliquely incident light (4.1 s-polarized, 4.2 p-polarized:
    resonance absorption); 5 Collisional absorption; 6 Parametric excitation of electron and ion waves
    (6.2 the ponderomotive force, 6.6 threshold due to inhomogeneity); 7 Stimulated Raman scattering
    (7.4 the 2ω_pe instability); 8 Stimulated Brillouin scattering (8.4 the filamentation instability);
    9 Heating by plasma waves (9.3 trapping, 9.4 wavebreaking); 10 Density profile modification
    (10.2 steepening); 11 Nonlinear features of underdense plasma instabilities; 12 Electron energy
    transport; 13 Laser plasma experiments (13.3 heated electron temperatures, 13.7 wavelength scaling).
    Companions: Atzeni & Meyer-ter-Vehn *The Physics of Inertial Fusion*; Lindl *Inertial Confinement Fusion*
    (Springer 1998); Drake *High-Energy-Density Physics*; Eliezer *The Interaction of High-Power Lasers
    with Plasmas*; Michel *Introduction to Laser-Plasma Interactions* (Springer 2023).
- `objectives`: 3 strings; `$...$` renders as math.
- `sections`: `{ id, label }` for every `<section id>` in the body, **plus `{ id: 'problems', label: 'Problems' }` last**
  (the lesson page renders the problems section itself).
- `body: () => (<>...</>)`: `<section id="...">` blocks, each starting with `<h2>`.
- `problems`: exactly 6. Ids `<L>-p1`…`<L>-p6`. At least 3 `numeric`. Every problem has 1–2 hints,
  a worked `solution`, and a `concept` tag (short kebab-case, e.g. `'ion-acoustic-speed'`).
- `cards`: exactly 6 flashcards, ids `<L>-c1`…`<L>-c6`.

Required body content per lesson:

- An opening section that gives the physical intuition before any maths.
- **At least 2 `<Eq>` explainers**, each with `symbols` for every tappable symbol, a `says` sentence,
  and `plot="<preset id>"` when a matching plot preset exists.
- **At least 1 `<Derivation>`** of 4–7 steps, most steps with a `why`. `id` unique within the lesson,
  `lessonId="<L>"`.
- **At least 1 simulation** (the flagship below) and **at least 1 plotter preset** embedded with
  `<Plotter spec={plotById('<id>')!} />` (import `plotById` from `./plots`).
- A short closing section that connects to the next lesson or to Tracks B/C where natural.

### KaTeX rules

- In `<Eq src="...">` JSX attributes (double quotes), backslashes are literal: `src="\s{w}{\omega_p} = ..."`.
- In JS strings (derivation `math`, problem text, cards) escape them: `'\\omega_p'`.
- `\s{key}{tex}` makes a tappable symbol; every `key` used must appear in `symbols`, and vice versa.
- In problems, cards and objectives, wrap maths in `$...$`.
- Never leave a KaTeX parse error; the smoke test reports them.

## Plot presets (`plots-<L>.ts`)

`PlotSpec` from `src/components/Plotter.tsx`. Ids are globally unique kebab-case; prefix them with your
lesson, e.g. `a5-ion-acoustic`, `b6-srs-growth`. Import `COLORS` from `../components/useCanvas`. Use log axes for
quantities spanning decades. Every curve's `fn` must return finite numbers over the axis range
(return `NaN` where undefined; the plotter breaks the line there). Markers only for well-established values.

## Simulations

- Wrap in `SimFrame` with a unique `id` (kebab-case, e.g. `'vlasov'`), a `title`, play/pause, reset, and a
  `hint` telling the learner what to try.
- Canvas: `const canvas = useCanvas(aspect, onResize?, maxHeight = 460)`; draw in device pixels
  (`c.width`, `c.height`), with `u = c.width / c.clientWidth` scaling fonts and line widths.
  Keep one scale for x and y whenever shapes (circles, orbits) must not distort.
- Phones: when `c.clientWidth < 560`, stack side panels underneath instead of beside, and pick a taller
  aspect (see `MirrorSim.tsx`). Nothing may overflow the card.
- Animation: `useAnimation(canvas, frame, running)`; it pauses when off-screen.
  **Keep a frame's physics under ~6 ms** on a laptop: coarse grids (64–128 points per axis), a few
  sub-steps per frame, typed arrays, no allocation in inner loops.
- Sliders: `Slider` from `SimFrame.tsx`; buttons `btn small`. Readouts in `<div className="readouts">`
  showing **measured vs theory**; add `className="ok"` on the measured value when within tolerance.
- Units: sims may use normalized units (ω_pe = 1, λ_D = 1, etc.); say which in the hint or readouts.
- Colors from `COLORS`; glowing lines with `glowStroke`. Labels ≥ 10 px (times `u`).

## Physics code and tests

- Pure functions in `src/physics/<name>.ts`, deterministic (seeded RNG when random).
- `src/physics/<name>.test.ts` must check each sim against its analytic result (growth rate, frequency,
  damping rate, speed, diffusion coefficient…) with a stated tolerance. Keep your test file under ~20 s.
- Run: `npx vitest run src/physics/<name>.test.ts`.

## Content standards

- **Original explanations only.** Never reproduce book text. Cite sections instead.
- **Correct physics.** SI units in formulas. Track B also gives the practical laser units the field uses
  (intensity in W/cm², wavelength in µm, density in cm⁻³, temperature in keV, e.g. $n_c \approx 1.1\times10^{21}/\lambda_{\mu m}^2$ cm⁻³),
  always labelled, next to the SI form. Kruer writes in Gaussian units and uses $v_{os} = eE_0/m\omega_0$; when you
  quote one of his results in SI, convert it and check the conversion numerically. Check every sign, factor of 2, 2π, and whether a thermal
  speed means √(kT/m) or √(2kT/m); say which one you use.
- **Every numeric answer computed with Python** (`python3 -c ...`) from CODATA constants, not by hand.
  Tolerance 2–5 %. Quote rounded values in solutions consistent with the answer.
- **Facts about real devices or experiments** only if well established; give rounded values and say
  "about". If you are not sure, leave it out.
- Prose: short paragraphs, plain sentences, intuition first, then the equation. No filler.
  Headings are short nouns. Match the tone of A1–A3.

## Verify before you finish (all in `$WT`)

1. `npx tsc --noEmit 2>&1 | grep -E "<your file names>"` shows nothing (errors in files you do not own can be ignored).
2. `npx vitest run src/physics/<name>.test.ts` passes.
3. Start a dev server on your assigned port:
   `VITE_CACHE_DIR=/tmp/claude-0/vite-cache-<PORT> node node_modules/vite/bin/vite.js --port <PORT> --strictPort > /tmp/claude-0/dev-<PORT>.log 2>&1 & echo $! > /tmp/claude-0/dev-<PORT>.pid`,
   then `node scripts/smoke.mjs <PORT> <L> /tmp/claude-0/shots/<label>-<L>` for each lesson.
   It must print `no problems`. Then **look at every screenshot** (desktop and phone) with the Read tool
   and fix clipped labels, overlaps, empty or frozen canvases, unreadable text.
4. Stop your dev server: `kill $(cat /tmp/claude-0/dev-<PORT>.pid)`. (Do not use `pkill -f`: it matches
   and kills your own shell.)
5. Copy your files back into `/home/claude/debye/`, then run step 1 and step 2 there once more.

Do not use any `mcp__hearthbot__` tool. Do not touch `/mnt/project-files`.
