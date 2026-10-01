import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { RTSim } from '../sims/RTSim'
import { TwoStreamSim } from '../sims/TwoStreamSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagrams ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 19 }

/** Plasma Rayleigh–Taylor: ion g×B drift along a rippled boundary, charge build-up, E and E×B. */
function PlasmaRTDiagram() {
  const lam = 270
  const k = (2 * Math.PI) / lam
  const x0 = 30
  const yb = (x: number) => 150 - 28 * Math.sin(k * (x - x0))
  let edge = ''
  for (let x = x0; x <= x0 + 2 * lam; x += 5) edge += `${x === x0 ? 'M' : 'L'}${x},${yb(x).toFixed(1)} `
  const plasma = `${edge} L${x0 + 2 * lam},40 L${x0},40 Z`
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, key: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 9
    return (
      <g key={key} stroke={color} fill={color} strokeWidth={2.5}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
      </g>
    )
  }
  const crests = [x0 + lam / 4, x0 + (5 * lam) / 4]
  const troughs = [x0 + (3 * lam) / 4, x0 + (7 * lam) / 4]
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 300" style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto' }} role="img" aria-label="Rayleigh–Taylor instability in a magnetized plasma">
        <rect x={x0} y={40} width={2 * lam} height={230} fill="#050b18" stroke="rgba(143,255,255,0.28)" />
        <path d={plasma} fill="rgba(244,114,182,0.22)" />
        <path d={edge} fill="none" stroke="#8fffff" strokeWidth={2.5} />
        {[80, 200, 330, 460].map((x) => (
          <g key={x} stroke="#9aa0c9" fill="none" strokeWidth={1.5}>
            <circle cx={x} cy={62} r={7} />
            <circle cx={x} cy={62} r={1.5} fill="#9aa0c9" />
          </g>
        ))}
        <text x={505} y={68} fill="#9aa0c9" style={svgText}>B ⊙</text>
        {arrow(575, 90, 575, 140, '#fbbf24', 'g')}
        <text x={555} y={112} fill="#fbbf24" style={svgText}>g</text>
        {arrow(250, 85, 170, 85, '#f472b6', 'drift')}
        <text x={262} y={91} fill="#f472b6" style={svgText}>ion drift ∝ g×B</text>
        {[x0, x0 + lam, x0 + 2 * lam].map((x) => (
          <text key={`m${x}`} x={x + (x === x0 ? 6 : x === x0 + 2 * lam ? -18 : -6)} y={yb(x) + 7} fill="#22d3ee" style={{ ...svgText, fontSize: 24, fontWeight: 700 }}>−</text>
        ))}
        {[x0 + lam / 2, x0 + (3 * lam) / 2].map((x) => (
          <text key={`p${x}`} x={x - 7} y={yb(x) + 7} fill="#fb5f5f" style={{ ...svgText, fontSize: 24, fontWeight: 700 }}>+</text>
        ))}
        {crests.map((x) => arrow(x + 32, 160, x - 32, 160, '#22d3ee', `ec${x}`))}
        {troughs.map((x) => arrow(x - 32, 140, x + 32, 140, '#22d3ee', `et${x}`))}
        {crests.map((x) => arrow(x, 238, x, 205, '#4ade80', `uc${x}`))}
        {troughs.map((x) => arrow(x, 205, x, 238, '#4ade80', `ut${x}`))}
        <text x={x0 + 8} y={262} fill="#9aa0c9" style={svgText}>light / vacuum</text>
        <text x={x0 + 8} y={125} fill="#e8eaf6" style={svgText}>plasma</text>
        <text x={x0 + lam / 4 + 44} y={166} fill="#22d3ee" style={svgText}>E</text>
        <text x={x0 + lam / 4 + 14} y={230} fill="#4ade80" style={svgText}>E×B</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        Plasma (pink) sits on a magnetic field (out of the page) that holds it up against gravity. Ions drift left along the boundary
        (electrons, much lighter, hardly drift). Where the ripple slopes, ions pile up on one flank and are depleted on the other. The
        resulting field E points along the boundary, and the E×B drift (green, drawn below the boundary for clarity) carries the whole plasma
        upward under each crest and downward at each trough: the ripple grows.
      </figcaption>
    </figure>
  )
}

/** Sausage (m = 0) and kink (m = 1) modes of a current-carrying column. */
function KinkSausageDiagram() {
  // sausage: radius r(x) with necks
  const r = (x: number) => 40 + 16 * Math.cos((2 * Math.PI * (x - 30)) / 80)
  let up = ''
  let dn = ''
  for (let x = 30; x <= 270; x += 4) {
    up += `${x === 30 ? 'M' : 'L'}${x},${(125 - r(x)).toFixed(1)} `
    dn = `L${x},${(125 + r(x)).toFixed(1)} ` + dn
  }
  const sausage = `${up} ${dn} Z`
  const loops = [30, 70, 110, 150, 190, 230, 270]
  // kink: centreline y_c(x), constant radius
  const yc = (x: number) => 125 + 34 * Math.sin((2 * Math.PI * (x - 340)) / 220)
  let kink = ''
  for (let x = 340; x <= 560; x += 4) kink += `${x === 340 ? 'M' : 'L'}${x},${yc(x).toFixed(1)} `
  const kloops = [350, 395, 450, 505, 550].map((x) => {
    const s = (2 * Math.PI) / 220
    const slope = 34 * s * Math.cos(s * (x - 340))
    return { x, y: yc(x), ang: (Math.atan(slope) * 180) / Math.PI }
  })
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, key: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 8
    return (
      <g key={key} stroke={color} fill={color} strokeWidth={2.5}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
      </g>
    )
  }
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 600 250" style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto' }} role="img" aria-label="Sausage and kink instabilities of a current-carrying plasma column">
        <path d={sausage} fill="rgba(244,114,182,0.25)" stroke="#f472b6" strokeWidth={2} />
        {loops.map((x) => {
          const neck = Math.abs(((x - 30) % 80) - 40) < 1
          return <ellipse key={x} cx={x} cy={125} rx={6} ry={r(x) + 5} fill="none" stroke={neck ? '#8fffff' : 'rgba(143,255,255,0.4)'} strokeWidth={neck ? 3 : 1.5} />
        })}
        {[70, 150, 230].map((x) => (
          <g key={x}>
            {arrow(x, 125 - r(x) - 34, x, 125 - r(x) - 10, '#fbbf24', `a${x}`)}
            {arrow(x, 125 + r(x) + 34, x, 125 + r(x) + 10, '#fbbf24', `b${x}`)}
          </g>
        ))}
        <text x={30} y={22} fill="#e8eaf6" style={svgText}>sausage, m = 0</text>
        <text x={30} y={242} fill="#9aa0c9" style={{ ...svgText, fontSize: 16 }}>necks: B_θ ∝ I/r is stronger</text>

        <path d={kink} fill="none" stroke="rgba(244,114,182,0.25)" strokeWidth={46} strokeLinecap="round" />
        <path d={kink} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="5 5" />
        {kloops.map((p) => (
          <ellipse key={p.x} cx={p.x} cy={p.y} rx={5} ry={30} transform={`rotate(${p.ang} ${p.x} ${p.y})`} fill="none" stroke="rgba(143,255,255,0.55)" strokeWidth={1.5} />
        ))}
        {arrow(395, yc(395) - 70, 395, yc(395) - 32, '#fbbf24', 'k1')}
        {arrow(505, yc(505) + 70, 505, yc(505) + 32, '#fbbf24', 'k2')}
        <text x={340} y={22} fill="#e8eaf6" style={svgText}>kink, m = 1</text>
        <text x={330} y={242} fill="#9aa0c9" style={{ ...svgText, fontSize: 16 }}>inside of each bend: B_θ crowded</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        A current I along the column makes a field B_θ that wraps around it (cyan loops) and squeezes it (the pinch). Left: where the column
        narrows, B_θ ∝ I/r grows, the magnetic pressure (amber) rises, and the neck is squeezed further. Right: where the column bends,
        the loops crowd together on the inside of the bend and spread out on the outside, so the magnetic pressure pushes the bend further out.
      </figcaption>
    </figure>
  )
}

export const A8: Lesson = {
  id: 'A8',
  title: 'Equilibrium & stability',
  subtitle: 'Pressure balance, β, frozen-in flux, the two-stream and Rayleigh–Taylor instabilities, kinks and sausages',
  minutes: 55,
  refs: [
    'Chen, Introduction to Plasma Physics and Controlled Fusion (3rd ed.), Ch. 6: hydromagnetic equilibrium, the concept of β, diffusion of magnetic field into a plasma, classification of instabilities, the two-stream instability, the “gravitational” instability',
    'Freidberg, Plasma Physics and Fusion Energy: the chapters on MHD equilibrium and MHD stability (kink and sausage modes, the Kruskal–Shafranov limit)',
    'Bellan, Fundamentals of Plasma Physics: the chapters on MHD equilibria and on streaming instabilities',
  ],
  objectives: [
    'Use $\\nabla p = \\mathbf{j}\\times\\mathbf{B}$ to explain pressure balance, $\\beta$, magnetic pressure and tension, and when flux is frozen in',
    'Derive the two-stream dispersion relation and find its maximum growth rate $\\gamma = \\omega_b/2$',
    'Explain the Rayleigh–Taylor instability in a fluid and in a plasma (through the $\\mathbf{g}\\times\\mathbf{B}$ drift), and measure its growth rate in a simulation against $\\sigma = \\sqrt{Agk}$ and its corrections for a finite interface width and viscosity',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'equilibrium', label: 'Equilibrium' },
    { id: 'tension', label: 'Pressure & tension' },
    { id: 'frozen', label: 'Frozen-in flux' },
    { id: 'zoo', label: 'Instabilities' },
    { id: 'twostream', label: 'Two-stream' },
    { id: 'rt', label: 'Rayleigh–Taylor' },
    { id: 'plasma-rt', label: 'RT in a plasma' },
    { id: 'kink', label: 'Kink & sausage' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          A marble at the bottom of a bowl and a marble balanced on top of an upturned bowl are both in <strong>equilibrium</strong>: the
          forces on each add to zero. Only the first is <strong>stable</strong>. Nudge the second and the nudge grows, exponentially at first,
          until the marble has rolled somewhere else entirely.
        </p>
        <p>
          A magnetically confined plasma raises both questions. First: can a magnetic field hold a hot gas at all, and how much? The answer
          is a force balance between the plasma’s pressure and the field’s. Second: is that balance a bowl or an upturned bowl? A plasma
          has a great deal of free energy to fall into (streams, density gradients, currents, field lines that bend the wrong way), and each
          kind of free energy feeds its own family of instabilities. This lesson builds the equilibrium, then grows two instabilities in
          real simulations and measures their growth rates.
        </p>
      </section>

      <section id="equilibrium">
        <h2>Hydromagnetic equilibrium</h2>
        <p>
          Sum the fluid momentum equations of A4 over ions and electrons. In a quasineutral plasma the electric forces cancel, and what is
          left in a steady state with no flow is a balance between the pressure gradient, which pushes outward, and the magnetic force on
          the plasma’s own current. That current is not imposed from outside: it is the diamagnetic current of A4, which flows exactly where
          the pressure changes.
        </p>
        <Eq
          title="Hydromagnetic equilibrium and pressure balance"
          src="\s{gp}{\nabla p} = \s{j}{\mathbf{j}}\times\s{B}{\mathbf{B}},\qquad \s{p}{p} + \dfrac{\s{B2}{B^2}}{2\s{mu}{\mu_0}} = \text{const}"
          plot="a8-pressure-balance"
          symbols={{
            gp: { name: '∇p, pressure gradient', units: 'Pa/m', note: 'Total plasma pressure p = n kT_e + n kT_i. It points inward in a confined plasma, so the force −∇p points outward.' },
            j: { name: 'j, current density', units: 'A/m²', note: 'The diamagnetic current B×∇p/B². Dotting the equation with j shows current lines lie on surfaces of constant pressure.' },
            B: { name: 'B, magnetic field', units: 'T', note: 'Dotting with B shows B·∇p = 0: field lines also lie on constant-pressure surfaces. Pressure is constant along a field line.' },
            p: { name: 'p, plasma pressure', units: 'Pa', note: 'The kinetic pressure of the particles.' },
            B2: { name: 'B²/2μ₀, magnetic pressure', units: 'Pa (J/m³)', note: 'The energy density of the field, which acts as a pressure. 1 T gives about 4×10⁵ Pa, roughly 4 atmospheres; 5 T gives about 100 atmospheres.' },
            mu: { name: 'μ₀, vacuum permeability', units: 'H/m', note: '4π×10⁻⁷ H/m.' },
          }}
          says="The first equation is the full force balance. The second holds when the field lines are straight and parallel: wherever the plasma pressure goes up, the field is weakened by exactly as much, so the sum stays flat. The plasma is a diamagnet that digs a hole in the field it sits in."
        />
        <Derivation
          lessonId="A8"
          id="balance"
          title="From force balance to magnetic pressure"
          steps={[
            { text: 'Start from the steady momentum equation for the whole plasma at rest, with no gravity.', math: '0 = \\mathbf{j}\\times\\mathbf{B} - \\nabla p', why: 'Adding the ion and electron equations of A4, the electric forces en(E) − en(E) cancel in a quasineutral plasma, and the two Lorentz terms combine into j×B with j = en(v_i − v_e).' },
            { text: 'Dot with B and then with j. Both field lines and current lines lie on surfaces of constant pressure.', math: '\\mathbf{B}\\cdot\\nabla p = 0,\\qquad \\mathbf{j}\\cdot\\nabla p = 0', why: 'j×B is perpendicular to both j and B. In a tokamak these constant-pressure surfaces are the nested “flux surfaces”.' },
            { text: 'Eliminate j with Ampère’s law. For slow changes the displacement current is negligible.', math: '\\begin{gathered}\\mu_0\\mathbf{j} = \\nabla\\times\\mathbf{B} \\\\ \\Rightarrow\\; \\nabla p = \\dfrac{1}{\\mu_0}(\\nabla\\times\\mathbf{B})\\times\\mathbf{B}\\end{gathered}' },
            { text: 'Use the vector identity for (∇×B)×B.', math: '\\begin{aligned}(\\nabla\\times\\mathbf{B})\\times\\mathbf{B} &= (\\mathbf{B}\\cdot\\nabla)\\mathbf{B} \\\\ &\\quad - \\nabla\\!\\left(\\tfrac{1}{2}B^2\\right)\\end{aligned}', why: 'It is the identity ∇(A·B) = (A·∇)B + (B·∇)A + A×(∇×B) + B×(∇×A) with A = B.' },
            { text: 'Collect the gradient terms on one side.', math: '\\nabla\\!\\left(p + \\dfrac{B^2}{2\\mu_0}\\right) = \\dfrac{(\\mathbf{B}\\cdot\\nabla)\\mathbf{B}}{\\mu_0}', why: 'B²/2μ₀ now appears on the same footing as p: a magnetic pressure. The right-hand side is the tension of curved field lines (next section).' },
            { text: 'For straight, parallel field lines B does not change along its own direction, so the right side vanishes.', math: 'p + \\dfrac{B^2}{2\\mu_0} = \\dfrac{B_0^2}{2\\mu_0}', why: 'B₀ is the field outside the plasma, where p = 0. Inside, B² = B₀² − 2μ₀p: the plasma pushes the field out of itself.' },
          ]}
        />
        <p>
          How well a field is used is measured by the ratio of the two pressures, <M>{'\\beta'}</M>. At <M>{'\\beta = 1'}</M> the plasma
          has pushed the field out of its core completely. A field is expensive (the coils, the stored energy), so fusion wants the highest
          β it can get; tokamaks run at a few percent, limited not by pressure balance but by the instabilities later in this lesson.
        </p>
        <Eq
          title="Plasma beta"
          src="\s{beta}{\beta} = \dfrac{\s{nkT}{\sum n k T}}{\s{B2}{B^2}/2\s{mu}{\mu_0}}"
          symbols={{
            beta: { name: 'β, plasma beta', note: 'Ratio of plasma pressure to magnetic pressure. Usually quoted at the centre of the plasma, or as a volume average.' },
            nkT: { name: 'Σ nkT, plasma pressure', units: 'Pa', note: 'Sum over species: n_e kT_e + n_i kT_i. With T_e = T_i and n_e = n_i it is 2nkT.' },
            B2: { name: 'B²/2μ₀, magnetic pressure', units: 'Pa', note: 'Using the vacuum field B₀, the field the coils would make with no plasma.' },
            mu: { name: 'μ₀, vacuum permeability', units: 'H/m', note: '4π×10⁻⁷ H/m.' },
          }}
          says="Low β: the field is stiff and the plasma barely dents it. β near 1: the plasma shoves the field aside. Space plasmas span the whole range: β ≪ 1 in the solar corona, where the field shapes everything, and β of order 1 in the solar wind near Earth."
        />
        <Plotter spec={plotById('a8-pressure-balance')!} />
      </section>

      <section id="tension">
        <h2>Magnetic pressure and tension</h2>
        <p>
          The j×B force splits cleanly into two parts. One is a pressure, B²/2μ₀, that pushes equally in every direction across the field.
          The other acts only when field lines are curved: like stretched rubber bands, they pull back toward straightness with a tension
          B²/μ₀. The field lines push sideways on each other and pull along themselves. This is the same tension that carries Alfvén waves
          in A6.
        </p>
        <Eq
          title="The two faces of j×B"
          src="\s{jB}{\mathbf{j}\times\mathbf{B}} = -\nabla_{\!\perp}\dfrac{\s{B2}{B^2}}{2\s{mu}{\mu_0}} + \dfrac{\s{B2}{B^2}}{\s{mu}{\mu_0}}\,\dfrac{\s{n}{\hat{\mathbf{n}}}}{\s{Rc}{R_c}}"
          symbols={{
            jB: { name: 'j×B, magnetic force density', units: 'N/m³', note: 'The force per unit volume the field exerts on the plasma current.' },
            B2: { name: 'B², field strength squared', units: 'T²', note: 'B²/2μ₀ is the magnetic pressure; B²/μ₀ is the tension along a field line, both in pascals.' },
            mu: { name: 'μ₀, vacuum permeability', units: 'H/m', note: '4π×10⁻⁷ H/m.' },
            n: { name: 'n̂, unit vector toward the centre of curvature', note: 'Points from a curved field line toward the centre of the circle that fits it.' },
            Rc: { name: 'R_c, radius of curvature', units: 'm', note: 'Sharper bends (small R_c) pull back harder.' },
          }}
          says="Only the gradient of B² across the field acts as a pressure; along the field the pressure part cancels against part of (B·∇)B, leaving pure tension toward the centre of curvature. A straight, uniform field exerts no force at all. A bent field line straightens; a squeezed bundle of field lines springs apart."
        />
        <p>
          These two ideas explain most of the stability results below. A plasma held by field lines that bulge <em>away</em> from it, with their centre of curvature on the plasma’s side
          (the outside of a torus), is being held up by rubber bands that it can slip between: bad curvature, unstable. A plasma surrounded by
          field lines that bulge <em>toward</em> it, with their centre of curvature outside the plasma (the inside of a torus, or a cusp), is
          cradled: good curvature.
        </p>
      </section>

      <section id="frozen">
        <h2>Frozen-in flux and magnetic diffusion</h2>
        <p>
          A field only confines a plasma if the two cannot slip through each other. Combining Ohm’s law for a moving conductor,
          E + v×B = ηj, with Faraday’s and Ampère’s laws gives an equation for how B changes. It has two terms that compete: the plasma
          dragging the field along with it, and the field diffusing through the plasma because of its resistivity.
        </p>
        <Eq
          title="Induction equation"
          src="\dfrac{\partial \s{B}{\mathbf{B}}}{\partial t} = \nabla\times(\s{v}{\mathbf{v}}\times\s{B}{\mathbf{B}}) + \dfrac{\s{eta}{\eta}}{\s{mu}{\mu_0}}\nabla^2\s{B}{\mathbf{B}}"
          plot="a8-magnetic-diffusion"
          symbols={{
            B: { name: 'B, magnetic field', units: 'T', note: 'Obeys ∇·B = 0, which was used to simplify ∇×(∇×B) = −∇²B.' },
            v: { name: 'v, plasma flow velocity', units: 'm/s', note: 'The first term carries field lines along with the flow: flux freezing.' },
            eta: { name: 'η, resistivity', units: 'Ω·m', note: 'The Spitzer resistivity of A7 for a fully ionized plasma, ∝ T_e^(−3/2).' },
            mu: { name: 'μ₀, vacuum permeability', units: 'H/m', note: 'η/μ₀ is a diffusion coefficient for magnetic field, in m²/s.' },
          }}
          says="Compare the two terms on a scale L: the ratio is the magnetic Reynolds number R_M = μ₀vL/η. When R_M ≫ 1 the flux through any loop moving with the plasma is constant, so field lines move with the plasma as if frozen in. When the plasma is at rest, the field just diffuses, on the time τ_B = μ₀L²/η."
        />
        <p>
          For a hydrogen plasma at 1 keV (η ≈ 2.5×10⁻⁸ Ω·m) of size 1 m, τ_B ≈ 50 s. A hot plasma therefore holds on to its field; any
          field you try to push in from outside takes that long to soak through, and a field trapped inside cannot escape quickly. That is
          why the field inside a plasma changes only slowly once it is set up, and why a plasma can be squeezed by a rising external field
          (the flux inside is carried along).
        </p>
        <Plotter spec={plotById('a8-magnetic-diffusion')!} />
      </section>

      <section id="zoo">
        <h2>Four families of instability</h2>
        <p>
          An equilibrium is unstable if some small disturbance can tap a source of free energy. Classifying instabilities by that source
          gives four families.
        </p>
        <div className="grid two">
          <div className="card">
            <span className="pill">Streaming</span>
            <p style={{ marginTop: 10 }}>
              A beam of particles, or two species drifting through each other (a current). The kinetic energy of the relative motion feeds
              electrostatic waves. The two-stream instability below is the simplest.
            </p>
          </div>
          <div className="card">
            <span className="pill violet">Rayleigh–Taylor</span>
            <p style={{ marginTop: 10 }}>
              A dense plasma held up against gravity, or against the effective gravity of curved field lines, by a lighter fluid or by the
              field itself. Potential energy is released when the two interchange. In magnetic confinement this is the “interchange” or
              “flute” mode.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Universal (drift)</span>
            <p style={{ marginTop: 10 }}>
              Any confined plasma has a density gradient, and that gradient alone drives drift waves, which travel at the diamagnetic drift
              speed of A4 and can grow through resistivity or kinetic effects. Because every bounded plasma has one, they are “universal”.
            </p>
          </div>
          <div className="card">
            <span className="pill ghost">Kinetic</span>
            <p style={{ marginTop: 10 }}>
              A distribution of velocities that is not Maxwellian: a bump on the tail, a loss-cone hole from a mirror (A3), unequal
              temperatures along and across B. Fluid theory cannot see these; kinetic theory (A9) is needed.
            </p>
          </div>
        </div>
        <p>
          The method is the same for all of them. Linearize the equations about the equilibrium, look for perturbations that vary as
          <M>{'\\ e^{i(kx - \\omega t)}'}</M>, and solve for ω(k). If ω has a positive imaginary part γ, the perturbation grows as
          <M>{'\\ e^{\\gamma t}'}</M>. Growth continues until the perturbation is big enough to change the equilibrium it feeds on.
        </p>
      </section>

      <section id="twostream">
        <h2>The two-stream instability</h2>
        <p>
          Two cold electron beams stream through each other. Suppose one beam bunches slightly. Its bunches make an electric field that
          the other beam sees at a Doppler-shifted frequency. If that frequency is right, the second beam bunches in step, its bunches push
          back on the first, and each amplifies the other. The kinetic energy of the streaming is the fuel. Try it in the particle-in-cell
          code from A1.
        </p>
        <TwoStreamSim />
        <Eq
          title="Two-stream dispersion relation (symmetric cold beams)"
          src="1 = \dfrac{\s{wb}{\omega_b}^2}{(\s{w}{\omega} - \s{k}{k}\s{v0}{v_0})^2} + \dfrac{\s{wb}{\omega_b}^2}{(\s{w}{\omega} + \s{k}{k}\s{v0}{v_0})^2}"
          plot="a8-two-stream"
          symbols={{
            wb: { name: 'ω_b, plasma frequency of one beam', units: 'rad/s', note: '√(n_b e²/ε₀m) with n_b the density of one beam. With two equal beams making up the whole plasma, ω_b² = ω_pe²/2.' },
            w: { name: 'ω, wave frequency', units: 'rad/s', note: 'Complex. A positive imaginary part γ means growth as e^(γt).' },
            k: { name: 'k, wavenumber', units: 'rad/m', note: 'Fixed by the box in the simulation: one wavelength fits.' },
            v0: { name: 'v₀, beam speed', units: 'm/s', note: 'The beams move at +v₀ and −v₀. Each term is one beam’s response, Doppler shifted by ±kv₀.' },
          }}
          says="Each beam alone is a plasma oscillation carried along at ±v₀: ω = ±kv₀ ± ω_b. Together they couple. For kv₀ < √2 ω_b the coupled mode is purely growing, fastest (γ = ω_b/2) at kv₀ = (√3/2)ω_b. In the simulation units, that is γ = ω_pe/(2√2) ≈ 0.354 ω_pe."
        />
        <Derivation
          lessonId="A8"
          id="twostream"
          title="Two-stream growth from cold-fluid beams"
          steps={[
            { text: 'Treat each beam as a cold electron fluid moving at u (= +v₀ or −v₀), with density n_b. Ions are a fixed background. Linearize momentum and continuity for small perturbations v₁, n₁, E₁.', math: '\\begin{gathered}m\\left(\\dfrac{\\partial}{\\partial t} + u\\dfrac{\\partial}{\\partial x}\\right)v_1 = -eE_1 \\\\ \\dfrac{\\partial n_1}{\\partial t} + u\\dfrac{\\partial n_1}{\\partial x} + n_b\\dfrac{\\partial v_1}{\\partial x} = 0\\end{gathered}', why: 'Cold: no pressure term. The convective derivative appears because each fluid element moves at u.' },
            { text: 'Try e^{i(kx−ωt)}. Every ∂/∂t + u∂/∂x becomes −i(ω − ku): the Doppler-shifted frequency the beam sees.', math: '\\begin{gathered}v_1 = \\dfrac{-ieE_1}{m(\\omega - ku)} \\\\ n_1 = \\dfrac{n_b k\\,v_1}{\\omega - ku} = \\dfrac{-i n_b e k E_1}{m(\\omega - ku)^2}\\end{gathered}' },
            { text: 'Poisson’s equation adds the charge of both beams.', math: '\\begin{gathered}ik\\varepsilon_0E_1 = -e\\left(n_{1+} + n_{1-}\\right) \\;\\Rightarrow \\\\ 1 = \\dfrac{\\omega_b^2}{(\\omega - kv_0)^2} + \\dfrac{\\omega_b^2}{(\\omega + kv_0)^2}\\end{gathered}', why: 'Substituting n₁ from the previous step, the factor ikE₁ cancels on both sides, leaving ε₀ = Σ n_b e²/(m(ω − ku)²).' },
            { text: 'Scale by ω_b: x = ω/ω_b, K = kv₀/ω_b. Clearing fractions gives a quadratic in x².', math: '\\begin{gathered}(x^2 - K^2)^2 = 2(x^2 + K^2) \\\\ \\Rightarrow\\; x^2 = K^2 + 1 \\pm \\sqrt{1 + 4K^2}\\end{gathered}', why: 'Multiply through by (x − K)²(x + K)² = (x² − K²)². The right side becomes (x + K)² + (x − K)² = 2(x² + K²).' },
            { text: 'The minus root is negative when (K² + 1)² < 1 + 4K², i.e. K < √2. Then x is imaginary: one mode grows, one decays.', math: '\\gamma = \\omega_b\\sqrt{\\sqrt{1 + 4K^2} - K^2 - 1}', why: 'x² < 0 means ω = ±iγ. There is no real frequency: the bunches stand still in the frame midway between the beams, as they must by symmetry.' },
            { text: 'Maximize γ² over K². Setting the derivative 2/√(1 + 4K²) − 1 to zero gives √(1 + 4K²) = 2.', math: '\\begin{gathered}K^2 = \\tfrac{3}{4}:\\quad kv_0 = \\tfrac{\\sqrt{3}}{2}\\,\\omega_b \\\\ \\gamma_{\\max} = \\tfrac{1}{2}\\,\\omega_b\\end{gathered}', why: 'γ²_max = 2 − 3/4 − 1 = 1/4. The fastest-growing wavelength is λ = 2π/k = 4πv₀/(√3 ω_b), about the distance a beam travels in one beam plasma period 2π/ω_b.' },
          ]}
        />
        <Plotter spec={plotById('a8-two-stream')!} />
        <p>
          The growth stops when the wave is strong enough to trap beam electrons in its troughs, which happens when the bounce frequency in
          the wave, <M>{'\\sqrt{ekE/m}'}</M>, catches up with γ. In phase space the two beams then roll up into vortices, and the stream
          energy has become a mix of wave energy and heat. Trapping comes back in A9.
        </p>
      </section>

      <section id="rt">
        <h2>The Rayleigh–Taylor instability</h2>
        <p>
          Turn a glass of water upside down with a card over it, then slide the card away. Air pressure alone could hold the water up, but
          the flat surface cannot stay flat: any ripple lets a little water fall and a little air rise, releasing potential energy, and the
          ripple grows. This is the Rayleigh–Taylor instability: a heavy fluid supported against gravity by a light one. In the simulation
          below, the “light fluid” is an ordinary fluid; in a plasma it can be a magnetic field.
        </p>
        <RTSim />
        <Eq
          title="Rayleigh–Taylor growth rate (sharp interface, no viscosity)"
          src="\s{s}{\sigma} = \sqrt{\s{A}{A}\,\s{g}{g}\,\s{k}{k}},\qquad \s{A}{A} = \dfrac{\s{rh}{\rho_h} - \s{rl}{\rho_l}}{\s{rh}{\rho_h} + \s{rl}{\rho_l}}"
          plot="a8-rt-growth"
          symbols={{
            s: { name: 'σ, growth rate', units: 's⁻¹', note: 'The ripple amplitude grows as e^(σt) while it is small (kη ≲ 0.5).' },
            A: { name: 'A, Atwood number', note: 'Between 0 (equal densities, nothing to gain) and 1 (heavy fluid over vacuum).' },
            g: { name: 'g, gravitational acceleration', units: 'm/s²', note: 'Any acceleration will do. In an accelerated frame, a light fluid pushing a heavy one is the same as the heavy one resting on it: this is why the RT instability threatens laser-driven fusion capsules (Track B).' },
            k: { name: 'k, ripple wavenumber', units: 'rad/m', note: '2π/λ. Short ripples grow fastest.' },
            rh: { name: 'ρ_h, heavy (upper) density', units: 'kg/m³', note: 'The fluid on top.' },
            rl: { name: 'ρ_l, light (lower) density', units: 'kg/m³', note: 'The fluid underneath. Put the light fluid on top instead (Flip in the simulation) and σ² changes sign: the ripple just oscillates as a gravity wave.' },
          }}
          says="The ripple grows faster the shorter it is, with no limit, in this idealized case. Real interfaces have a width δ and viscosity ν: a ripple much shorter than δ barely sees a density jump, and viscosity kills short ripples outright. Both appear in the plot preset and in the simulation’s linear-theory readout."
        />
        <p>
          The simulation is a two-dimensional Boussinesq fluid solver: the density difference enters only through buoyancy. For a sharp
          interface this gives exactly the same linear growth rate, √(Agk), as the full equations at any Atwood number, but it makes the late
          fingers symmetric (real heavy spikes fall faster than light
          bubbles rise when A is near 1). The interface starts as a smooth step of half-width δ = 0.02. Once the ripple is about as tall as
          it is wide, the flow along the fingers shears the interface, and the Kelvin–Helmholtz instability curls the tips into the
          familiar mushroom caps.
        </p>
        <Plotter spec={plotById('a8-rt-growth')!} />
      </section>

      <section id="plasma-rt">
        <h2>Rayleigh–Taylor in a plasma</h2>
        <p>
          Now let a magnetic field hold a plasma up against gravity. Nothing is “falling through” anything: the plasma is tied to the field
          lines. The instability works instead through the drifts of A2. Gravity is a force that does not care about charge, so ions and
          electrons drift in opposite directions along the boundary at <M>{'\\mathbf{v}_g = (m/q)\\,\\mathbf{g}\\times\\mathbf{B}/B^2'}</M>,
          and the ions, being heavier, drift faster (about 1836 times faster, for hydrogen). On a rippled boundary this drift piles up charge, and the charge makes
          an electric field whose E×B drift amplifies the ripple.
        </p>
        <PlasmaRTDiagram />
        <Derivation
          lessonId="A8"
          id="plasma-rt"
          title="Growth rate from drifts alone"
          steps={[
            { text: 'Set up: B = Bẑ out of the page, gravity g = −gŷ, and a plasma whose density n₀(y) increases upward (heavy on top) with scale length L_n = n₀/(dn₀/dy). Ions drift along x; electron drifts from gravity are negligible.', math: '\\mathbf{v}_g = \\dfrac{M}{e}\\dfrac{\\mathbf{g}\\times\\mathbf{B}}{B^2} = -\\dfrac{g}{\\Omega_c}\\,\\hat{\\mathbf{x}}', why: 'Ω_c = eB/M is the ion cyclotron frequency. ŷ×ẑ = x̂, and g points along −ŷ, so the ions go along −x.' },
            { text: 'Perturb with a ripple ∝ e^{i(kx − ωt)}, slow compared with Ω_c. It creates a potential φ₁ and field E_x = −ikφ₁. Both species E×B drift in y; only the ions have a polarization drift along E, because it is proportional to mass.', math: 'v_{E,y} = -\\dfrac{E_x}{B},\\quad v_{p,x} = \\dfrac{1}{\\Omega_c B}\\dfrac{dE_x}{dt}', why: 'The polarization drift appears whenever E changes: to keep up with a growing E×B drift a gyrating ion must pick up extra speed, and it does so by sliding a little along E. It is the ions’ inertia showing through, and it is what sets the timescale of the instability.' },
            { text: 'Electron continuity: the E×B drift carries the background gradient across y. This links the density ripple to the field.', math: '\\begin{gathered}-i\\omega n_1 + v_{E,y}\\,\\dfrac{dn_0}{dy} = 0 \\\\ \\Rightarrow\\; n_1 = -\\dfrac{E_x}{i\\omega B}\\,\\dfrac{dn_0}{dy}\\end{gathered}', why: 'E×B is incompressible in a uniform B, so it only moves density around, bringing dense plasma up or down.' },
            { text: 'Ion continuity has two extra terms: the ion drift v_g sliding the ripple along x, and the divergence of the polarization drift. Quasineutrality (n_i1 = n_e1) makes everything else cancel against the electron equation.', math: '\\begin{gathered}ik\\,v_g\\,n_1 + n_0\\,ik\\,v_{p,x} = 0 \\\\ \\dfrac{dE_x}{dt} = -i(\\omega - kv_g)E_x\\end{gathered}', why: 'The ion drift is the charge-separating current: if it did not match the polarization current, charge would build up without limit. The ions see E change at their own Doppler-shifted frequency ω − kv_g.' },
            { text: 'Substitute n₁ from the electron equation and v_{p,x}, and cancel E_x.', math: '\\omega^2 - \\omega k v_g + g\\,\\dfrac{1}{n_0}\\dfrac{dn_0}{dy} = 0', why: 'Ω_c v_g = −g brings in the gravity. The E_x, B and k all cancel: the result depends only on g, the gradient, and the drift.' },
            { text: 'With heavy on top, dn₀/dy > 0 and, neglecting the small kv_g, ω² is negative.', math: '\\gamma = \\sqrt{\\dfrac{g}{L_n}}', why: 'The exact root is γ = √(g/L_n − k²v_g²/4), so the ion drift weakly stabilizes short waves. If the density decreased upward (light on top), dn₀/dy < 0 makes ω² = g/|L_n| > 0, and the ripple would only oscillate, just as in the flipped fluid simulation.' },
          ]}
        />
        <Eq
          title="Plasma Rayleigh–Taylor growth rate"
          src="\s{gam}{\gamma} = \sqrt{\dfrac{\s{g}{g}}{\s{L}{L_n}}},\qquad \s{g}{g_{\rm eff}} \sim \dfrac{\s{vt}{v_{th}^2}}{\s{Rc}{R_c}}"
          symbols={{
            gam: { name: 'γ, growth rate', units: 's⁻¹', note: 'Compare σ = √(Agk) for a fluid with A ≈ 1: the density scale length L_n plays the role of 1/k. A ripple much shorter than the gradient sees only the gradient, just as σ² → Ag/δ for a fluid interface of width δ.' },
            g: { name: 'g, gravity or effective gravity', units: 'm/s²', note: 'Real gravity matters in the ionosphere and for the Sun; in the lab the effective gravity of curved field lines dominates.' },
            L: { name: 'L_n, density scale length', units: 'm', note: 'n/(dn/dy). A steeper edge grows faster.' },
            vt: { name: 'v_th², thermal speed squared', units: 'm²/s²', note: 'A particle following a curved field line at speed v∥ feels a centrifugal force mv∥²/R_c; together with the ∇B drift of A2 this averages to an effective gravitational acceleration of order kT/(mR_c).' },
            Rc: { name: 'R_c, field-line radius of curvature', units: 'm', note: 'About the major radius R in a tokamak. The effective gravity points away from the centre of curvature.' },
          }}
          says="Replace gravity by field-line curvature and you have the interchange instability of magnetic confinement: where field lines curve away from the plasma (the outside of a torus) the plasma is heavy fluid on top. This is why simple toroidal fields fail, and why tokamaks twist their field lines so that each line spends time on the good side as well as the bad."
        />
      </section>

      <section id="kink">
        <h2>Kinks and sausages</h2>
        <p>
          The simplest magnetic bottle is a pinch: drive a current I along a column of plasma and its own field B_θ = μ₀I/2πr wraps around it
          and squeezes it. Pressure balance is easy to satisfy (the Bennett pinch). Stability is not. Both of the modes below are driven by the
          current, and both follow from the pressure and tension picture.
        </p>
        <KinkSausageDiagram />
        <p>
          The <strong>sausage</strong> (m = 0) is squeezed where it is already thin, because B_θ ∝ 1/r is strongest there. A field B_z along
          the column fixes it: the axial flux trapped inside is compressed at a neck and pushes back, and for a thin surface current the neck
          is stable when <M>{'B_z^2 > B_\\theta^2/2'}</M>. The <strong>kink</strong> (m = 1) is pushed further out wherever it bends, because the
          loops of B_θ crowd together on the inside of the bend. B_z helps here too, through tension: bending the column bends its axial field
          lines, and they resist. How much B_z is enough is set by how much the field lines twist.
        </p>
        <Eq
          title="Kruskal–Shafranov limit"
          src="\s{q}{q}(\s{a}{a}) = \dfrac{\s{a}{a}\,\s{Bz}{B_z}}{\s{R}{R}\,\s{Bt}{B_\theta(a)}} > 1"
          symbols={{
            q: { name: 'q, safety factor', note: 'How many times a field line goes the long way round the torus for each time it goes the short way round. q = 1 means one full twist per length 2πR.' },
            a: { name: 'a, minor radius', units: 'm', note: 'Radius of the plasma column.' },
            Bz: { name: 'B_z, axial (toroidal) field', units: 'T', note: 'The strong field from the external coils in a tokamak.' },
            R: { name: 'R, major radius', units: 'm', note: 'Bend a column of length 2πR into a torus and R is the radius of the ring.' },
            Bt: { name: 'B_θ(a), poloidal field at the edge', units: 'T', note: 'From the plasma current: μ₀I/(2πa). More current, more twist, lower q.' },
          }}
          says="If the field lines at the edge wind around the column more than once in the length 2πR, a helical kink can line up with them and grow freely. Keeping q(a) > 1 sets a maximum plasma current for a given B_z. In practice tokamaks keep q at the edge well above this, typically near 3."
        />
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Every instability here was found from fluid equations. Some cannot be. A bump on the tail of the velocity distribution drives waves
          that fluid theory cannot see, and a plasma wave in a perfectly stable Maxwellian plasma still damps away without a single collision.
          Both need the velocity distribution itself: kinetic theory, A9. The kink and the q limit return in A11, where they set how much
          current, and therefore how much heating and confinement, a tokamak can have. In Track B the two-stream and Rayleigh–Taylor
          instabilities come back in laser plasmas: hot-electron beams and the imploding shells of fusion capsules.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'A8-p1',
      kind: 'numeric',
      concept: 'plasma-beta',
      prompt: 'A tokamak plasma has $n_e = n_i = 10^{20}\\ \\text{m}^{-3}$, $T_e = T_i = 10$ keV and a field of 5 T. What is its β, in percent?',
      answer: 3.22,
      tol: 0.03,
      unit: '%',
      hints: ['Plasma pressure $p = n kT_e + n kT_i = 2nkT$, with $kT = 10^4 \\times 1.602\\times10^{-19}$ J.', 'Magnetic pressure $B^2/2\\mu_0 = 25/(2\\times4\\pi\\times10^{-7})$ Pa.'],
      solution: '$p = 2\\times10^{20}\\times1.602\\times10^{-15} = 3.20\\times10^5$ Pa. $B^2/2\\mu_0 = 9.95\\times10^6$ Pa (about 98 atmospheres). $\\beta = 3.20\\times10^5/9.95\\times10^6 = 0.032$, i.e. 3.2%.',
    },
    {
      id: 'A8-p2',
      kind: 'numeric',
      concept: 'magnetic-diffusion',
      prompt: 'A hydrogen plasma at $T_e = 1$ keV with $\\ln\\Lambda = 15$ is 1 m across. Using the Spitzer resistivity $\\eta \\approx 5.2\\times10^{-5}\\ln\\Lambda/T_{eV}^{3/2}$ Ω·m, estimate the magnetic diffusion time $\\tau_B = \\mu_0 L^2/\\eta$ with $L = 1$ m, in seconds.',
      answer: 50.9,
      tol: 0.03,
      unit: 's',
      hints: ['$T_{eV}^{3/2} = 1000^{1.5} = 3.16\\times10^4$.', '$\\eta = 2.47\\times10^{-8}$ Ω·m; $\\mu_0 = 1.257\\times10^{-6}$ H/m.'],
      solution: '$\\eta = 5.2\\times10^{-5}\\times15/3.16\\times10^4 = 2.47\\times10^{-8}$ Ω·m. $\\tau_B = 1.257\\times10^{-6}/2.47\\times10^{-8} = 51$ s. The field is frozen in on any shorter timescale.',
    },
    {
      id: 'A8-p3',
      kind: 'numeric',
      concept: 'two-stream',
      prompt: 'Two cold electron beams, each of density $5\\times10^{16}\\ \\text{m}^{-3}$, stream through each other at $\\pm10^6$ m/s. What is the wavelength of the fastest-growing two-stream mode, in mm?',
      answer: 0.575,
      tol: 0.03,
      unit: 'mm',
      hints: ['Each beam has $\\omega_b = \\sqrt{n_b e^2/\\varepsilon_0 m_e}$.', 'Fastest growth at $kv_0 = (\\sqrt{3}/2)\\,\\omega_b$, so $k = (\\sqrt{3}/2)\\,\\omega_b/v_0$ and $\\lambda = 2\\pi/k$.'],
      solution: '$\\omega_b = \\sqrt{5\\times10^{16}\\times(1.602\\times10^{-19})^2/(8.854\\times10^{-12}\\times9.109\\times10^{-31})} = 1.26\\times10^{10}$ rad/s. $k = 0.866\\times1.26\\times10^{10}/10^6 = 1.09\\times10^4$ m⁻¹, so $\\lambda = 2\\pi/k = 5.75\\times10^{-4}$ m = 0.575 mm. It grows at $\\gamma = \\omega_b/2 = 6.3\\times10^9$ s⁻¹: one e-fold every 0.16 ns.',
    },
    {
      id: 'A8-p4',
      kind: 'numeric',
      concept: 'rayleigh-taylor',
      prompt: 'Water (1000 kg/m³) sits on top of air (1.2 kg/m³). A ripple on the interface has a wavelength of 10 cm. Ignoring viscosity and surface tension, how long does it take the ripple to grow by a factor e, in milliseconds?',
      answer: 40.3,
      tol: 0.03,
      unit: 'ms',
      hints: ['$A = (1000 - 1.2)/(1000 + 1.2) \\approx 0.998$.', '$k = 2\\pi/0.1 = 62.8$ m⁻¹, and the e-folding time is $1/\\sigma$ with $\\sigma = \\sqrt{Agk}$.'],
      solution: '$\\sigma = \\sqrt{0.998\\times9.81\\times62.8} = 24.8$ s⁻¹, so the e-folding time is $1/24.8 = 0.040$ s = 40 ms. (Surface tension changes this by only about 1.5% at this wavelength, but it does stabilize ripples shorter than about 1.7 cm.)',
    },
    {
      id: 'A8-p5',
      kind: 'mcq',
      concept: 'plasma-rayleigh-taylor',
      prompt: 'In the Rayleigh–Taylor instability of a magnetized plasma supported against gravity, what creates the electric field that makes a ripple grow?',
      options: [
        'Electrons falling faster than ions',
        'The opposite $\\mathbf{g}\\times\\mathbf{B}$ drifts of ions and electrons pile up charge on the flanks of each ripple',
        'The E×B drift, which separates ions from electrons',
        'Collisions between the plasma and the magnetic field',
      ],
      correct: 1,
      hints: ['Which drift depends on the sign of the charge? Which one does not?'],
      solution: 'Gravity is independent of charge, so $\\mathbf{v}_g = (m/q)\\,\\mathbf{g}\\times\\mathbf{B}/B^2$ has opposite signs for ions and electrons (and the ions’ is far larger). Where the boundary is tilted, this current deposits charge. The E field between the charges then drives an E×B drift, which moves ions and electrons together and pushes the ripple crests further out.',
    },
    {
      id: 'A8-p6',
      kind: 'mcq',
      concept: 'kink-instability',
      prompt: 'A tokamak operator raises the plasma current at fixed toroidal field. Which instability limit gets closer, and why?',
      options: [
        'The two-stream limit, because the electrons drift faster',
        'The kink (Kruskal–Shafranov) limit, because more current means more poloidal field, more twist, and a lower edge safety factor $q(a)$',
        'The sausage limit, because $B_z$ becomes stronger',
        'None: more current always improves confinement',
      ],
      correct: 1,
      hints: ['$q(a) = aB_z/(RB_\\theta(a))$ and $B_\\theta(a) = \\mu_0 I/(2\\pi a)$.'],
      solution: 'More current raises $B_\\theta$, so field lines twist faster around the column and $q(a)$ falls. When $q(a)$ drops toward 1 (in practice toward about 2), a helical kink can line up with the field lines and grow. This sets the maximum current for a given field and size.',
    },
  ],
  cards: [
    { id: 'A8-c1', front: 'Hydromagnetic equilibrium, and what it becomes for straight field lines', back: '$\\nabla p = \\mathbf{j}\\times\\mathbf{B}$, i.e. $\\nabla(p + B^2/2\\mu_0) = (\\mathbf{B}\\cdot\\nabla)\\mathbf{B}/\\mu_0$; straight lines: $p + B^2/2\\mu_0 = $ const' },
    { id: 'A8-c2', front: 'Plasma β, and a typical tokamak value', back: '$\\beta = \\sum nkT/(B^2/2\\mu_0)$; a few percent in a tokamak' },
    { id: 'A8-c3', front: 'When is magnetic flux frozen into a plasma?', back: 'When the magnetic Reynolds number $R_M = \\mu_0 vL/\\eta \\gg 1$; otherwise B diffuses in a time $\\tau_B = \\mu_0 L^2/\\eta$' },
    { id: 'A8-c4', front: 'Symmetric cold two-stream instability: fastest growth and cut-off', back: '$\\gamma_{\\max} = \\omega_b/2$ at $kv_0 = (\\sqrt{3}/2)\\omega_b$; stable for $kv_0 > \\sqrt{2}\\,\\omega_b$' },
    { id: 'A8-c5', front: 'Rayleigh–Taylor growth rate: fluid and plasma', back: 'Fluid: $\\sigma = \\sqrt{Agk}$. Plasma: $\\gamma = \\sqrt{g/L_n}$, driven by charge from the $\\mathbf{g}\\times\\mathbf{B}$ drift; curvature acts as gravity' },
    { id: 'A8-c6', front: 'Kruskal–Shafranov condition for kink stability', back: '$q(a) = aB_z/(RB_\\theta(a)) > 1$: field lines must twist less than once around the column per length $2\\pi R$' },
  ],
}
