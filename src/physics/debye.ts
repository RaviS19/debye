// Debye shielding as a Metropolis Monte Carlo: electrons sample the Boltzmann
// distribution n ∝ exp(eφ/kT) in the screened potential of a test charge.
// Lengths are in units of the view width; the physics enters through λ and the
// coupling strength s = eφ/kT at r = λ_D.

export interface DebyeState {
  xs: Float32Array
  ys: Float32Array
  charges: { x: number; y: number; sign: 1 | -1 }[]
  lambda: number
  strength: number
}

/** Dimensionless energy U/kT of an electron at (x, y). Negative U attracts it. */
export function electronEnergy(s: DebyeState, x: number, y: number): number {
  let u = 0
  const core = 0.5 * s.lambda // finite-size core keeps eφ/kT bounded, as the linear theory assumes
  for (const c of s.charges) {
    const r = Math.max(Math.hypot(x - c.x, y - c.y), core)
    // eφ/kT = strength · (λ/r) · e^{−(r−λ)/λ}, normalized so it equals `strength` at r = λ
    const phi = s.strength * (s.lambda / r) * Math.exp(-(r - s.lambda) / s.lambda)
    u -= c.sign * phi
  }
  return u
}

export function createDebye(n: number, rand = Math.random): DebyeState {
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    xs[i] = rand()
    ys[i] = rand()
  }
  return { xs, ys, charges: [{ x: 0.5, y: 0.5, sign: 1 }], lambda: 0.12, strength: 0.8 }
}

/** One Metropolis sweep; returns the acceptance rate. */
export function sweepDebye(s: DebyeState, stepSize = 0.03, rand = Math.random): number {
  let accepted = 0
  const n = s.xs.length
  for (let i = 0; i < n; i++) {
    const x0 = s.xs[i]
    const y0 = s.ys[i]
    let x1 = x0 + (rand() - 0.5) * 2 * stepSize
    let y1 = y0 + (rand() - 0.5) * 2 * stepSize
    x1 -= Math.floor(x1)
    y1 -= Math.floor(y1)
    const dU = electronEnergy(s, x1, y1) - electronEnergy(s, x0, y0)
    if (dU <= 0 || rand() < Math.exp(-dU)) {
      s.xs[i] = x1
      s.ys[i] = y1
      accepted++
    }
  }
  return accepted / n
}

/** Radial density of electrons around the first test charge, normalized to the mean (→ 1 far away). */
export function radialProfile(s: DebyeState, bins: number, rMax: number): number[] {
  const c = s.charges[0]
  const counts = new Array(bins).fill(0)
  const n = s.xs.length
  for (let i = 0; i < n; i++) {
    let dx = s.xs[i] - c.x
    let dy = s.ys[i] - c.y
    dx -= Math.round(dx)
    dy -= Math.round(dy)
    const r = Math.hypot(dx, dy)
    if (r < rMax) counts[Math.floor((r / rMax) * bins)]++
  }
  const dr = rMax / bins
  return counts.map((k, b) => {
    const area = Math.PI * ((b + 1) ** 2 - b ** 2) * dr * dr
    return k / (area * n)
  })
}

/**
 * The Boltzmann density exp(−U)/⟨exp(−U)⟩ the sampler should reproduce. The average over the
 * box matters: electrons pulled into the cloud come from the background, so far away n < 1.
 */
export function theoryDensity(s: DebyeState, r: number): number {
  const c = s.charges[0]
  const one = { ...s, charges: [c] }
  const g = 80
  let z = 0
  for (let i = 0; i < g; i++)
    for (let j = 0; j < g; j++) {
      let dx = (i + 0.5) / g - c.x
      let dy = (j + 0.5) / g - c.y
      dx -= Math.round(dx)
      dy -= Math.round(dy)
      z += Math.exp(-electronEnergy(one, c.x + dx, c.y + dy))
    }
  z /= g * g
  return Math.exp(-electronEnergy(one, c.x + r, c.y)) / z
}
