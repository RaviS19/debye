import { Eq, M } from '../components/Eq'
import { Derivation } from '../components/Learning'
import { Plotter } from '../components/Plotter'
import { ResonanceSim } from '../sims/ResonanceSim'
import { plotById } from './plots'
import type { Lesson } from './types'

// ---------- diagram ----------
const svgText = { fontFamily: '"PT Sans", sans-serif', fontSize: 17 }

/** Oblique p-polarized light in a ramp: the ray turns at n_c cos²θ, where its field points along ∇n, and the
 *  field tunnels on to the critical surface. The density gradient points up the page. */
function GeometryDiagram() {
  const L = 240 // px from the plasma edge to n_c
  const th = (40 * Math.PI) / 180
  const s2 = Math.sin(th) ** 2
  const cot = 1 / Math.tan(th)
  const yMax = 2 * L * s2 * cot // where the ray turns (sideways distance)
  const X0 = 84 // svg x where the ray enters the plasma
  const Yb = 330 // svg y of the plasma edge
  const xPhys = (y: number) => cot * y - (y * y) / (4 * L * s2)
  const P = (y: number): [number, number] => [X0 + y, Yb - xPhys(y)]
  const vac = 46 // vacuum stretch, measured along ∇n
  let ray = `M${(X0 - vac * Math.tan(th)).toFixed(1)},${Yb + vac} L${X0},${Yb} `
  for (let y = 0; y <= 2 * yMax + 0.01; y += 4) ray += `L${P(y)[0].toFixed(1)},${P(y)[1].toFixed(1)} `
  ray += `L${(X0 + 2 * yMax + vac * Math.tan(th)).toFixed(1)},${Yb + vac}`
  const yc = Yb - L // n_c
  const yt = Yb - L * Math.cos(th) ** 2 // turning point
  // E arrows: perpendicular to the ray, in the plane
  const arrows = [0.3, 0.62, 1, 1.38, 1.7].map((f) => {
    const y = f * yMax
    const slope = cot - y / (2 * L * s2) // dx/dy
    const nx = slope
    const ny = 1
    const m = Math.hypot(nx, ny)
    const [cx, cy] = P(y)
    const len = f === 1 ? 26 : 17
    return { x1: cx - (len * nx) / m, y1: cy - (len * ny) / m, x2: cx + (len * nx) / m, y2: cy + (len * ny) / m }
  })
  const head = (x1: number, y1: number, x2: number, y2: number) => {
    const a = Math.atan2(y2 - y1, x2 - x1)
    const h = 8
    return `M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`
  }
  const [tx, ty] = P(yMax)
  return (
    <figure className="card" style={{ margin: '16px 0' }}>
      <svg viewBox="0 0 640 400" style={{ width: '100%', maxWidth: 660, display: 'block', margin: '0 auto' }} role="img" aria-label="Obliquely incident p-polarized light turning in a density ramp, with its field tunnelling to the critical surface">
        <defs>
          <linearGradient id="b3-dens" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="rgba(160,111,214,0)" />
            <stop offset="1" stopColor="rgba(160,111,214,0.42)" />
          </linearGradient>
          <linearGradient id="b3-tunnel" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="rgba(251,191,36,0.32)" />
            <stop offset="1" stopColor="rgba(251,191,36,0.03)" />
          </linearGradient>
        </defs>
        <rect x={0} y={yc - 34} width={640} height={Yb - yc + 34} fill="url(#b3-dens)" />
        <rect x={tx - 60} y={yc} width={120} height={yt - yc} fill="url(#b3-tunnel)" />
        <line x1={0} y1={Yb} x2={640} y2={Yb} stroke="#a06fd6" strokeWidth={1.5} />
        <line x1={0} y1={yt} x2={640} y2={yt} stroke="#fbbf24" strokeWidth={1.6} strokeDasharray="6 5" />
        <line x1={0} y1={yc} x2={640} y2={yc} stroke="#fb5f5f" strokeWidth={1.8} strokeDasharray="6 5" />
        <path d={ray} fill="none" stroke="#22d3ee" strokeWidth={3} />
        {arrows.map((a, i) => (
          <g key={i} stroke="#f472b6" fill="#f472b6" strokeWidth={2.6}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
            <path d={head(a.x1, a.y1, a.x2, a.y2)} stroke="none" />
            <path d={head(a.x2, a.y2, a.x1, a.y1)} stroke="none" />
          </g>
        ))}
        {/* resonance: E_x oscillation at the critical surface */}
        <g stroke="#fbbf24" strokeWidth={2.4}>
          {[-36, -18, 0, 18, 36].map((d) => (
            <line key={d} x1={tx + d} y1={yc - 12} x2={tx + d} y2={yc + 12} />
          ))}
        </g>
        <line x1={tx - 48} y1={yc} x2={tx + 48} y2={yc} stroke="#fff" strokeWidth={3} opacity={0.85} />
        {/* angle of incidence */}
        <line x1={X0} y1={Yb} x2={X0} y2={Yb + 52} stroke="#9aa0c9" strokeWidth={1.3} strokeDasharray="4 4" />
        <path d={`M${X0},${Yb + 38} A38,38 0 0,1 ${X0 - 38 * Math.sin(th)},${Yb + 38 * Math.cos(th)}`} fill="none" stroke="#e8eaf6" strokeWidth={1.5} />
        <text x={X0 - 32} y={Yb + 66} fill="#e8eaf6" style={svgText}>θ</text>
        {/* gradient arrow */}
        <g stroke="#a06fd6" fill="#a06fd6" strokeWidth={2.4}>
          <line x1={612} y1={300} x2={612} y2={196} />
          <path d={head(612, 300, 612, 196)} stroke="none" />
        </g>
        <text x={548} y={316} fill="#a06fd6" style={svgText}>∇n</text>
        <text x={8} y={Yb + 22} fill="#9aa0c9" style={svgText}>vacuum</text>
        <text x={8} y={yt - 8} fill="#fbbf24" style={svgText}>n_c cos²θ: light turns</text>
        <text x={8} y={yc - 8} fill="#fb5f5f" style={svgText}>n_c: ε = 0</text>
        <text x={tx + 58} y={yc - 10} fill="#fbbf24" style={svgText}>resonance: E_x ≫ E₀</text>
        <text x={tx + 66} y={(yt + yc) / 2 + 6} fill="#fbbf24" style={{ ...svgText, fontSize: 15 }}>field tunnels</text>
        <text x={tx + 34} y={ty + 34} fill="#f472b6" style={{ ...svgText, fontSize: 15 }}>E along ∇n</text>
        <text x={432} y={372} fill="#22d3ee" style={svgText}>reflected light</text>
      </svg>
      <figcaption className="small dim" style={{ marginTop: 6 }}>
        p-polarized light (electric field, magenta, in the plane of incidence) enters a density ramp at angle θ. It bends away from the
        gradient and turns at n_c cos²θ, where it travels along the density contours and its electric field points straight along ∇n.
        Beyond that point it cannot propagate, but its evanescent field reaches the critical surface, where ε = 0 and the component along ∇n
        drives the electrons in resonance (amber). s-polarized light has its field out of the page, along the contours, so it never
        pushes electrons along ∇n.
      </figcaption>
    </figure>
  )
}

export const B3: Lesson = {
  id: 'B3',
  title: 'Resonance absorption',
  subtitle: 'p-polarized light, the plasma resonance at the critical surface, and the Denisov curve',
  minutes: 55,
  refs: [
    'Kruer, The Physics of Laser Plasma Interactions, Ch. 4 (obliquely incident light): 4.1 s-polarized light, 4.2 p-polarized light and resonance absorption (the driver field, the function φ(τ) and the absorption f_A ≈ φ²/2); Ch. 10 (density profile modification) for steepened profiles',
    'Ginzburg, The Propagation of Electromagnetic Waves in Plasmas (2nd ed.), the chapter on the plasma resonance in an inhomogeneous layer (Denisov’s function)',
    'Eliezer, The Interaction of High-Power Lasers with Plasmas: the chapter on laser absorption (resonance absorption, vacuum heating)',
    'Freidberg, Mitchell, Morse and Rudsinski, “Resonant absorption of laser light by plasma targets”, Phys. Rev. Lett. 28, 795 (1972): the full-wave calculation for a linear ramp',
  ],
  objectives: [
    'Explain why only p-polarized light is resonantly absorbed: its field has a component along $\\nabla n$, and $E_x = D_x/(\\varepsilon_0\\varepsilon)$ becomes huge where $\\varepsilon = 0$',
    'Derive the absorbed fraction $f_A = \\pi k_0L\\,|E_d|^2/(E_0^2\\cos\\theta)$, show it does not depend on the damping rate, and estimate it as $f_A \\approx \\phi^2(\\tau)/2$ with $\\tau = (k_0L)^{1/3}\\sin\\theta$',
    'Find the best angle of incidence for a given scale length from the exact full-wave curve (peak 49% at $\\tau \\approx 0.68$), and say where Ginzburg’s formula fails',
  ],
  sections: [
    { id: 'idea', label: 'The idea' },
    { id: 'geometry', label: 's and p' },
    { id: 'resonance', label: 'The resonance' },
    { id: 'power', label: 'Absorbed power' },
    { id: 'denisov', label: 'Denisov curve' },
    { id: 'sim', label: 'Angle sweep' },
    { id: 'angle', label: 'Best angle' },
    { id: 'damping', label: 'Where it goes' },
    { id: 'steep', label: 'Steep profiles' },
    { id: 'next', label: 'Next' },
    { id: 'problems', label: 'Problems' },
  ],
  body: () => (
    <>
      <section id="idea">
        <h2>The idea</h2>
        <p>
          Push a child on a swing once per swing and the motion grows until friction takes as much as you give. Electrons in a plasma have a
          natural frequency too, ω_pe, set by the local density. In a density ramp there is one layer, the critical surface, where ω_pe equals
          the laser frequency exactly. If the laser’s electric field can shake electrons <em>across</em> that layer, along the density
          gradient, it drives them at their resonance. The charge sheets that form there oscillate with a field far larger than the laser’s
          own, and whatever damps that oscillation (collisions, Landau damping, wave breaking) turns the light into heat and fast electrons.
        </p>
        <p>
          Two conditions decide how much light is caught. The field must have a component along the gradient, which needs oblique incidence and
          the right polarization. And the field must reach the critical surface, which oblique light cannot quite do: it turns back at a lower
          density (B1) and only its evanescent tail tunnels on to n_c. Too small an angle gives too little field along ∇n, too large an angle
          gives too long a tunnel. In between, about half of the light can be absorbed, without a single collision. That is resonance absorption,
          and it was the dominant absorption mechanism in many experiments with long-wavelength lasers and hot coronas.
        </p>
      </section>

      <section id="geometry">
        <h2>s and p polarization</h2>
        <p>
          Let the density increase along x and the light arrive in the x–y plane (the plane of incidence) at angle θ to the gradient. Because
          nothing varies along y, the component <M>{'k_y = k_0\\sin\\theta'}</M> is conserved, and B1 showed the light turns where
          n = n_c cos²θ. There are two independent polarizations. In <strong>s polarization</strong> the electric field points along z, out
          of the plane, parallel to the density contours. In <strong>p polarization</strong> the magnetic field points along z and the
          electric field lies in the plane of incidence, so part of it points along ∇n.
        </p>
        <GeometryDiagram />
        <p>
          B2 treated the s-polarized case: its field only makes electrons quiver along the contours, so it can be absorbed only by collisions.
          The p-polarized wave obeys a different equation, because the electric field along x piles up charge. Written for <M>{'H_z(x)'}</M>, with the
          time dependence <M>{'e^{i(k_y y - \\omega t)}'}</M>:
        </p>
        <Eq
          title="Wave equation for p-polarized light"
          src="\begin{gathered}\dfrac{d}{dx}\!\left(\dfrac{1}{\s{eps}{\varepsilon}}\dfrac{d\s{H}{H_z}}{dx}\right) \\ +\ \s{k0}{k_0}^2\left(1 - \dfrac{\sin^2\s{th}{\theta}}{\varepsilon}\right)H_z = 0\end{gathered}"
          symbols={{
            eps: { name: 'ε(x), dielectric function', note: 'ε = 1 − ω_pe²/[ω(ω + iν)] = 1 − (n/n_c)/(1 + iν/ω). It passes through zero (nearly) at the critical density n = n_c.' },
            H: { name: 'H_z, magnetic field of the wave', units: 'A/m', note: 'Smooth everywhere, including at n_c. The electric field follows from Ampère’s law: E_x = −k_y H_z/(ωε₀ε), E_y = −i(dH_z/dx)/(ωε₀ε).' },
            k0: { name: 'k₀ = ω/c, vacuum wavenumber', units: 'm⁻¹', note: 'k₀L is the ramp length in units of λ/2π.' },
            th: { name: 'θ, angle of incidence', note: 'Measured from the density gradient. k_y = k₀ sin θ is the same everywhere, which is Snell’s law.' },
          }}
          says="Multiply through by ε and it reads H″ − (ε′/ε)H′ + k₀²(ε − sin²θ)H = 0: the s-polarized equation of B1 plus a term ε′/ε that is singular where ε = 0. At normal incidence it is equivalent to the s equation, so both polarizations behave identically there; at oblique incidence the singular term is the whole story of this lesson."
        />
      </section>

      <section id="resonance">
        <h2>The resonance</h2>
        <p>
          Ampère’s law makes the displacement <M>{'D_x = \\varepsilon_0\\varepsilon E_x = -k_yH_z/\\omega'}</M>, and H_z is smooth, so D_x is smooth.
          The electric field is D_x divided by ε, and ε passes through zero at the critical surface. The plasma there answers the slightest field
          along the gradient with a huge oscillation, just as a driven oscillator answers a force at its natural frequency: ε = 0 is precisely
          the statement that the electrons’ natural frequency ω_pe equals ω.
        </p>
        <Eq
          title="The resonant field at the critical surface"
          src="\begin{gathered}\s{Ex}{E_x} = \dfrac{\s{D}{D_x}}{\varepsilon_0\,\s{eps}{\varepsilon}(x)} \\ \varepsilon \approx \dfrac{\s{L}{L} - x}{L} + i\,\dfrac{\s{nu}{\nu}}{\s{w}{\omega}}\ \ \text{near } x = L\end{gathered}"
          symbols={{
            Ex: { name: 'E_x, field along the density gradient', units: 'V/m', note: 'Peaks at |D_x|/(ε₀ν/ω) exactly at n_c, in a layer of width about Lν/ω. With ν/ω = 10⁻³ it is a thousand times the driver.' },
            D: { name: 'D_x = −k_y H_z/ω, displacement', units: 'C/m²', note: 'Smooth across the resonance. |D_x|/ε₀ at x = L is the driver field E_d.' },
            eps: { name: 'ε(x), dielectric function', note: 'For a linear ramp n = n_c x/L its real part falls through zero at x = L with slope −1/L.' },
            L: { name: 'L, density scale length', units: 'm', note: 'Here the length of the linear ramp from the plasma edge to n_c, so n = n_c x/L.' },
            nu: { name: 'ν, damping rate', units: 's⁻¹', note: 'Collisions here; Landau damping or the escape of the plasma wave in a warm plasma play the same role.' },
            w: { name: 'ω, laser frequency', units: 'rad/s', note: 'Equal to ω_pe at x = L.' },
          }}
          says="E_x is a Lorentzian spike centred on n_c: height E_d ω/ν, width Lν/ω. Halve the damping and the spike doubles in height and halves in width, so its area, and with it the absorbed power, stays the same."
        />
      </section>

      <section id="power">
        <h2>The absorbed power</h2>
        <p>
          Two steps give the absorption: the power a given driver field deposits in the spike, and the size of the driver field that the light
          delivers to n_c. The first is exact for weak damping; the second needs an approximation, which the full-wave solution then tests.
        </p>
        <Derivation
          lessonId="B3"
          id="resonance-absorption"
          title="From the resonant spike to f_A ≈ φ²(τ)/2"
          steps={[
            {
              text: 'The power a field deposits per unit volume is ½ωε₀ Im ε |E|². Near n_c only E_x matters, and E_x = E_d/ε with the driver E_d = |D_x|/ε₀ at x = L.',
              math: '\\begin{gathered}P_{\\rm abs} = \\dfrac{\\omega\\varepsilon_0}{2} \\\\ \\times\\int \\dfrac{(\\nu/\\omega)\\,E_d^2\\,dx}{(x-L)^2/L^2 + \\nu^2/\\omega^2}\\end{gathered}',
              why: 'Im ε = (n/n_c)(ν/ω)/(1 + ν²/ω²) ≈ ν/ω at n_c, and |ε|² ≈ (x − L)²/L² + ν²/ω² there. For ν ≪ ω the integrand is a narrow Lorentzian, so E_d can be taken outside the integral.',
            },
            {
              text: 'The Lorentzian integral is π L ω/ν. The damping rate cancels.',
              math: 'P_{\\rm abs} = \\dfrac{\\pi}{2}\\,\\omega\\varepsilon_0 L\\,E_d^2',
              why: '∫ dx/(a² + (x − L)²/L²) = πL/a with a = ν/ω, and (ν/ω)·πL/(ν/ω) = πL. Weaker damping makes a taller, narrower spike with the same area. This is why resonance absorption does not care what the damping is, as long as it is weak.',
            },
            {
              text: 'Divide by the incident power per unit area of the target, ½ε₀cE₀² cos θ.',
              math: 'f_A = \\dfrac{\\pi k_0 L}{\\cos\\theta}\\,\\dfrac{E_d^2}{E_0^2}',
              why: 'k₀ = ω/c. The cos θ is the projection of the beam onto the target. Every remaining question is about E_d, the field that reaches n_c.',
            },
            {
              text: 'Small angles. As θ → 0 the magnetic field at n_c tends to its normal-incidence value, which B1’s Airy solution gives: cB = (1/ik₀) dE/dx with E = 2√π (k₀L)^(1/6) E₀ Ai(ζ). Then E_d = sin θ · c|B(L)|.',
              math: 'c|B(L)| = \\dfrac{2\\sqrt\\pi\\,|{\\rm Ai}\'(0)|}{(k_0L)^{1/6}}E_0 \\;\\Rightarrow\\; E_d = \\dfrac{2.30\\,\\tau}{\\sqrt{2\\pi k_0L}}\\,E_0',
              why: 'dζ/dx = 1/δ with δ = ∛(L/k₀²), so c|B(L)| = 2√π(k₀L)^(1/6)|Ai′(0)|/(k₀δ) and k₀δ = ∛(k₀L). With sin θ = τ/∛(k₀L), E_d = 2√π|Ai′(0)| τ E₀/√(k₀L), and 2√π × 0.2588 × √(2π) = 2.300. This defines τ = ∛(k₀L) sin θ.',
            },
            {
              text: 'Larger angles. The light now turns at n_c cos²θ, a distance L sin²θ = τ²δ before n_c, and its field must tunnel the rest of the way. In Airy units the evanescent field falls as exp(−⅔ζ√ζ), and ζ = τ² at n_c. Ginzburg combined the two limits into one estimate.',
              math: 'E_d \\approx \\dfrac{E_0\\,\\phi(\\tau)}{\\sqrt{2\\pi k_0 L}},\\qquad \\phi(\\tau) \\approx 2.3\\,\\tau\\,e^{-2\\tau^3/3}',
              why: 'This is an interpolation, not a derivation: the 2.3τ is exact for small τ, and the exponential is the WKB tunnelling factor, which is only accurate when τ is large, where the absorption is small anyway.',
            },
            {
              text: 'Put E_d into f_A (cos θ ≈ 1 for the small angles involved) and maximize.',
              math: 'f_A \\approx \\tfrac12\\phi^2(\\tau) = 2.65\\,\\tau^2 e^{-4\\tau^3/3},\\qquad \\tau_{\\rm opt} = 2^{-1/3} = 0.79',
              why: 'd/dτ[τ² exp(−4τ³/3)] = 0 gives τ³ = ½. The formula then predicts 86% absorption at the peak. The exact solution in the next section peaks at only 49%, at τ = 0.68: the formula is within 10% of it only for τ ≲ 0.25, and only qualitative near its peak.',
            },
          ]}
        />
      </section>

      <section id="denisov">
        <h2>The Denisov curve</h2>
        <p>
          The p-polarized wave equation can be solved numerically without any approximation, for any angle and ramp, by integrating it from deep
          in the overdense plasma out to the vacuum and splitting the field there into incident and reflected waves. To pass the resonance with
          ν → 0, the integration steps around the pole of 1/ε on a small semicircle in the complex x plane, exactly as Landau’s contour does in A9.
          Denisov worked out this problem in the 1950s. Two facts come out of it, and the simulation below reproduces both.
        </p>
        <p>
          First, for k₀L ≳ 10 the absorbed fraction depends on the angle and the scale length only through τ: curves for k₀L = 50, 200 and 800
          fall on top of each other to within half a percent. Second, the peak is lower and earlier than Ginzburg’s formula says:{' '}
          <strong>49.4% at τ = 0.681</strong>, against 86% at τ = 0.79. The formula is within 10% for τ ≲ 0.25 and about right in shape, but the
          tunnelling factor e<sup>−2τ³/3</sup> is far too generous near the peak. When an estimate matters, use the exact curve.
        </p>
        <Eq
          title="Resonance absorption in a linear ramp"
          src="\begin{gathered}\s{f}{f_A} \approx \tfrac12\,\s{phi}{\phi}^2(\s{tau}{\tau}) \\ \tau = (\s{k0}{k_0}\s{L}{L})^{1/3}\sin\s{th}{\theta}\end{gathered}"
          plot="b3-denisov"
          symbols={{
            f: { name: 'f_A, absorbed fraction', note: 'Fraction of the incident power deposited at the critical surface, for weak damping. Exact peak: 0.494 at τ = 0.681.' },
            phi: { name: 'φ(τ), Denisov function', note: 'φ = E_d√(2πk₀L)/E₀, the normalized driver field. Ginzburg’s approximation 2.3τ exp(−2τ³/3) reaches 1.31; the exact φ = √(2f_A) peaks at 0.99.' },
            tau: { name: 'τ, the resonance parameter', note: 'τ² = L sin²θ/δ is the tunnelling distance from the turning point to n_c in units of the Airy width δ = ∛(L/k₀²).' },
            k0: { name: 'k₀ = 2π/λ', units: 'm⁻¹', note: 'Vacuum wavenumber of the laser.' },
            L: { name: 'L, ramp length (edge to n_c)', units: 'm', note: 'For a general smooth profile use the local scale length n/(dn/dx) at n_c.' },
            th: { name: 'θ, angle of incidence', note: 'Typically a few degrees to ten degrees for real scale lengths: τ = 0.68 at L = 100 µm and λ = 0.351 µm needs only 3.2°.' },
          }}
          says="One function of one variable describes resonance absorption for every angle and every scale length. Small τ: little field along ∇n. Large τ: the field dies before it reaches n_c. The optimum, about half the light absorbed, sits at τ ≈ 0.7."
        />
        <Plotter spec={plotById('b3-denisov')!} />
      </section>

      <section id="sim">
        <h2>Angle sweep</h2>
        <p>
          The simulation solves both wave equations on a non-uniform grid (the step shrinks to a few percent of the distance to the pole near
          n_c) with a small, density-proportional collision rate as in B2. The first panel shows the whole ramp, with the field oscillating
          at ω; the second zooms on the critical region on a log scale, where the spike in E_x stands out; the third builds the absorbed
          fraction against angle, one full-wave solve per point.
        </p>
        <ResonanceSim />
        <p>Things to try:</p>
        <ul>
          <li>
            <strong>Damping does not matter.</strong> At the optimum angle, step ν_c/ω from 10⁻³ down to 10⁻⁶. The peak |E_x| grows a
            thousandfold, always equal to the driver divided by ν/ω (the readout checks it). The p-polarized absorption falls only from about 56%
            to 49.5% (L = 10 λ). The difference is ordinary collisional absorption along the path, which the s curve shows on its own (12% at
            ν_c/ω = 10⁻³, nearly zero at 10⁻⁶); the two act in series, so the reflectivities roughly multiply: 0.505 × 0.88 ≈ 0.44 = 1 − 0.56.
            The resonant part itself does not change.
          </li>
          <li>
            <strong>Normal incidence.</strong> At θ = 0 the s and p curves start from the same point: with no field along ∇n there is no
            resonance, and the two wave equations become equivalent.
          </li>
          <li>
            <strong>One variable.</strong> Note the angle of the peak at L = 10 λ (about 10°), then make the ramp ten times longer: the optimum
            moves to 4.6°, a factor 10<sup>1/3</sup> = 2.15 smaller, while the peak height stays near 49%.
          </li>
          <li>
            <strong>Energy check.</strong> The readout integrates the collisional heating ½ωε₀ Im ε|E|² over the whole ramp and compares it with
            1 − |r|² from the reflected wave. They agree to better than 0.1%, a test that the solver conserves energy through the resonance.
          </li>
        </ul>
      </section>

      <section id="angle">
        <h2>Choosing the angle</h2>
        <p>
          Since only τ matters, the best angle follows from sin θ_opt = 0.68/∛(k₀L). For 0.351 µm light on a 100 µm ramp, k₀L ≈ 1790 and
          θ_opt ≈ 3.2°; for 1.053 µm light on a 10 µm ramp, k₀L ≈ 60 and θ_opt ≈ 10°. The window is broad in τ (above half the peak from
          τ = 0.34 to 1.06), so even a focused beam, which contains a spread of angles, gets a fair share of resonance absorption.
        </p>
        <Plotter spec={plotById('b3-optimum-angle')!} />
        <p>
          Resonance absorption is strongest where collisional absorption is weakest: at long wavelengths (the resonant layer is at low density,
          where collisions are rare), high temperatures and short scale lengths. Collisional absorption (B2) grows with ν_c L, resonance absorption
          needs only τ in the right range. Comparing the two is how experiments with CO₂ lasers (10.6 µm) in the 1970s were understood: much of
          the light they absorbed went in through the resonance and came out as hot electrons. Shorter wavelengths shifted the balance to
          collisions, which is one reason laser fusion moved to 0.35 µm light.
        </p>
      </section>

      <section id="damping">
        <h2>Where the energy goes</h2>
        <p>
          The resonance only needs <em>some</em> damping to absorb; what kind decides where the energy ends up. With collisions it heats the
          bulk electrons at n_c. In a hot plasma collisions are too slow, and thermal pressure takes over: the driven oscillation becomes an
          electron plasma wave (A5) that propagates down the density gradient, toward lower density. There its wavenumber grows, its phase
          velocity falls toward the thermal speed, and Landau damping (A9) absorbs it. The plasma wave then plays the role of ν, and the field
          at n_c is limited to about <M>{'E_d\\,L/\\Delta'}</M> with the Airy width of the plasma wave <M>{'\\Delta = (3\\lambda_D^2L)^{1/3}'}</M>,
          from the Bohm–Gross term 3k²v_te² in ε (with v_te² = kT_e/m_e as in A5, so 3v_te²/ω² = 3λ_D² at n_c).
        </p>
        <p>
          If the driven wave is strong enough, it breaks before it damps: electrons are thrown out of the wave in bursts, carrying the absorbed
          energy away as a hot tail far above the thermal temperature. These hot electrons, with energies of tens of keV for typical 1 µm
          experiments, preheat fusion fuel and are the subject of B8. The absorbed fraction is still given by the Denisov curve; only the fate of
          the energy changes.
        </p>
      </section>

      <section id="steep">
        <h2>Steep profiles</h2>
        <p>
          The light’s own pressure modifies the ramp. The swollen field just below n_c (B1) pushes plasma out of the region where it is
          strongest, and the profile near the critical surface steepens into a step a few wavelengths or less across (Kruer, Ch. 10; B4 shows
          the mechanism). A shorter local L means a smaller τ at the same angle, so the optimum moves to larger angles, and resonance absorption
          remains efficient over a wider range of angles.
        </p>
        <p>
          Push this to its limit, a ramp shorter than the distance an electron swings in one laser period (v_os/ω ≳ L, which needs k₀L ≲ 1 and an
          intense field), and the fluid resonance stops making sense. The field along ∇n then drags electrons straight out into the vacuum and
          throws them back into the solid half a cycle later, where they deposit their energy beyond the reach of the field. This is vacuum
          heating, or Brunel absorption, the dominant mechanism for intense short pulses on solid targets (Track C, C5).
        </p>
      </section>

      <section id="next">
        <h2>Where this leads</h2>
        <p>
          Resonance absorption needs a field along ∇n and a resonance at n_c. The next lesson, B4, asks what the swollen light field does to the
          plasma that carries it: the ponderomotive force pushes electrons out of bright regions, steepens the profile at the critical surface
          and, through it, changes the τ of this lesson. The hot electrons made by the resonant plasma wave return in B8.
        </p>
      </section>
    </>
  ),
  problems: [
    {
      id: 'B3-p1',
      kind: 'numeric',
      concept: 'resonance-tau',
      prompt: 'A Nd:glass laser ($\\lambda = 1.053$ µm) hits a target whose density rises linearly to $n_c$ over $L = 20$ µm, at $10^\\circ$ to the density gradient. What is the resonance parameter $\\tau = (k_0L)^{1/3}\\sin\\theta$?',
      answer: 0.855,
      tol: 0.02,
      unit: '',
      hints: ['$k_0L = 2\\pi L/\\lambda$.', '$k_0L = 119.3$, and its cube root is 4.92.'],
      solution: '$k_0L = 2\\pi\\times20/1.053 = 119.3$, $(k_0L)^{1/3} = 4.923$, $\\sin 10^\\circ = 0.1736$, so $\\tau = 0.855$. That is just past the exact optimum (0.68); the exact curve gives $f_A \\approx 0.43$, Ginzburg’s formula 0.84.',
    },
    {
      id: 'B3-p2',
      kind: 'numeric',
      concept: 'resonance-optimum-angle',
      prompt: 'Frequency-tripled light ($\\lambda = 0.351$ µm) falls on a linear ramp with $L = 50$ µm. Using the exact optimum $\\tau_{\\rm opt} = 0.68$, at what angle of incidence is resonance absorption largest, in degrees?',
      answer: 4.05,
      tol: 0.03,
      unit: '°',
      hints: ['$\\sin\\theta_{\\rm opt} = \\tau_{\\rm opt}/(k_0L)^{1/3}$.', '$k_0L = 2\\pi\\times50/0.351 = 895$.'],
      solution: '$(k_0L)^{1/3} = 895^{1/3} = 9.64$, so $\\sin\\theta = 0.68/9.64 = 0.0706$ and $\\theta = 4.05^\\circ$. Ginzburg’s formula ($\\tau = 0.79$) would say 4.7°. Either way the angles are small: long ramps need nearly normal incidence.',
    },
    {
      id: 'B3-p3',
      kind: 'numeric',
      concept: 'denisov-function',
      prompt: 'Use Ginzburg’s approximation $\\phi(\\tau) \\approx 2.3\\tau e^{-2\\tau^3/3}$, $f_A \\approx \\phi^2/2$, to estimate the absorbed fraction at $\\tau = 0.4$, in percent.',
      answer: 38.9,
      tol: 0.02,
      unit: '%',
      hints: ['$2\\tau^3/3 = 0.0427$ at $\\tau = 0.4$.'],
      solution: '$\\phi = 2.3\\times0.4\\times e^{-0.0427} = 0.92\\times0.958 = 0.882$, so $f_A = 0.882^2/2 = 0.389$, about 39%. The exact full-wave value at $\\tau = 0.4$ is 31.6%: the approximation is already 23% high here, and by its peak it is 73% high.',
    },
    {
      id: 'B3-p4',
      kind: 'numeric',
      concept: 'resonance-thermal-width',
      prompt: 'In a hot plasma the resonance is limited by the plasma wave rather than by collisions, over a width $\\Delta = (3\\lambda_D^2L)^{1/3}$. For $\\lambda = 1.053$ µm light ($n_c = 1.005\\times10^{27}$ m⁻³), $T_e = 1$ keV at $n_c$ and $L = 30$ µm, what is $\\Delta$, in µm?',
      answer: 0.170,
      tol: 0.03,
      unit: 'µm',
      hints: ['$\\lambda_D = \\sqrt{\\varepsilon_0 kT_e/(n_c e^2)}$, about 7.4 nm here.', '$3\\lambda_D^2 L = 3\\times(7.41\\times10^{-9})^2\\times3\\times10^{-5}$ m³.'],
      solution: '$\\lambda_D = \\sqrt{8.854\\times10^{-12}\\times1000/(1.005\\times10^{27}\\times1.602\\times10^{-19})} = 7.41$ nm. Then $\\Delta = (3\\times5.50\\times10^{-17}\\times3\\times10^{-5})^{1/3} = 1.70\\times10^{-7}$ m $= 0.170$ µm. The resonant field is limited to roughly $L/\\Delta \\approx 180$ times the driver, as if $\\nu/\\omega \\approx 0.006$. The Airy width of the light, $(L/k_0^2)^{1/3} = 0.94$ µm, is five times larger.',
    },
    {
      id: 'B3-p5',
      kind: 'mcq',
      concept: 'resonance-damping-independence',
      prompt: 'Resonance absorption at fixed angle and scale length, with weak collisional damping. If the collision frequency at $n_c$ is halved, what happens?',
      options: [
        'The absorbed fraction halves, because the heating rate is proportional to ν',
        'The absorbed fraction is essentially unchanged; the peak of $E_x$ doubles and its width halves',
        'The absorbed fraction doubles, because the resonant field doubles',
        'Resonance absorption switches off until ν is restored',
      ],
      correct: 1,
      hints: ['Write the heating as $\\int \\nu|E_x|^2dx$ with $E_x = E_d/\\varepsilon$ and $|\\varepsilon|^2 \\approx (x-L)^2/L^2 + \\nu^2/\\omega^2$.'],
      solution: 'The heating density is proportional to $\\nu|E_x|^2$, and $|E_x|^2$ is a Lorentzian of height $\\propto 1/\\nu^2$ and width $\\propto \\nu$. The integral $\\nu\\times\\nu^{-2}\\times\\nu$ does not depend on ν: $P = \\tfrac{\\pi}{2}\\omega\\varepsilon_0 L E_d^2$. The absorption is set by how much field reaches $n_c$, not by how the energy is dissipated.',
    },
    {
      id: 'B3-p6',
      kind: 'mcq',
      concept: 'resonance-polarization',
      prompt: 'Light falls at 8° on a long linear ramp with negligible collisions. Which statement is correct?',
      options: [
        's-polarized light is absorbed resonantly, because its field is parallel to the critical surface',
        'Both polarizations are absorbed equally, because they turn at the same density $n_c\\cos^2\\theta$',
        'Only p-polarized light is absorbed: its electric field has a component along ∇n, which drives charge oscillations at $n_c$; s-polarized light is reflected almost completely',
        'Neither is absorbed, because the light turns before it reaches $n_c$',
      ],
      correct: 2,
      hints: ['Which polarization has an electric field component along the density gradient?'],
      solution: 'Both turn at $n_c\\cos^2\\theta$, but only the p-polarized field has a component along ∇n. Its evanescent tail reaches $n_c$, where $E_x = D_x/(\\varepsilon_0\\varepsilon)$ resonates. The s-polarized field lies along the contours; it makes no charge separation and, without collisions, is totally reflected.',
    },
  ],
  cards: [
    { id: 'B3-c1', front: 'Why does only p-polarized light undergo resonance absorption?', back: 'Its electric field has a component along $\\nabla n$. $D_x = \\varepsilon_0\\varepsilon E_x$ is smooth, so $E_x = D_x/(\\varepsilon_0\\varepsilon)$ becomes huge where $\\varepsilon = 0$, at $n_c$' },
    { id: 'B3-c2', front: 'The resonance-absorption parameter τ and the exact optimum (linear ramp)', back: '$\\tau = (k_0L)^{1/3}\\sin\\theta$; exact peak $f_A = 0.49$ at $\\tau = 0.68$' },
    { id: 'B3-c3', front: 'Ginzburg’s approximation to resonance absorption, and how good it is', back: '$f_A \\approx \\phi^2/2$, $\\phi \\approx 2.3\\tau e^{-2\\tau^3/3}$: exact as $\\tau \\to 0$, but its peak (86% at τ = 0.79) is far above the exact 49% at 0.68' },
    { id: 'B3-c4', front: 'Absorbed power at a resonance with weak damping ν', back: '$P = \\tfrac{\\pi}{2}\\omega\\varepsilon_0 L E_d^2$, independent of ν. The spike has height $E_d\\omega/\\nu$ and width $L\\nu/\\omega$' },
    { id: 'B3-c5', front: 'Where does oblique light turn in a linear ramp, and how far must its field tunnel?', back: 'At $n_c\\cos^2\\theta$, a distance $L\\sin^2\\theta = \\tau^2\\delta$ below $n_c$, with $\\delta = (L/k_0^2)^{1/3}$' },
    { id: 'B3-c6', front: 'What happens to the resonantly absorbed energy?', back: 'It drives an electron plasma wave at $n_c$, damped by collisions, by Landau damping as it runs down the gradient, or by wave breaking, which makes hot electrons (B8). For $k_0L \\lesssim 1$ and $v_{os}/\\omega \\gtrsim L$: vacuum heating instead' },
  ],
}
