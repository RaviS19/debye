// A11: an ion in a simple circular tokamak, pushed with the Boris scheme in Cartesian coordinates.
// Normalized units: major radius R₀ = 1, field on axis B₀ = 1, ion q/m = 1, so times are in 1/ω_c0.
// Field: B = B₀R₀/R φ̂ + (B₀ r/(q R)) θ̂  (toroidal field ∝ 1/R plus the poloidal field of a plasma current,
// with constant safety factor q). In (R, φ, Z): B_R = −B₀ z/(qR), B_Z = B₀(R − R₀)/(qR); ∇·B = 0 exactly.

export interface TokamakField {
  q: number // safety factor; Infinity (or current off) → no poloidal field
  current: boolean
}

/** Particle state [x, y, z, vx, vy, vz] plus scratch for the field. */
export type OrbitState = Float64Array

const Bs = new Float64Array(3)

/** Field at a point, written into out[0..2]. */
export function tokamakB(x: number, y: number, z: number, f: TokamakField, out: Float64Array = Bs): Float64Array {
  const R = Math.sqrt(x * x + y * y)
  const c = x / R
  const s = y / R
  const Bphi = 1 / R
  let BR = 0
  let BZ = 0
  if (f.current) {
    BR = -z / (f.q * R)
    BZ = (R - 1) / (f.q * R)
  }
  out[0] = BR * c - Bphi * s
  out[1] = BR * s + Bphi * c
  out[2] = BZ
  return out
}

/** Boris step, allocation-free. */
export function borisTokamak(p: OrbitState, f: TokamakField, dt: number): void {
  const B = tokamakB(p[0], p[1], p[2], f)
  const h = dt / 2
  const tx = h * B[0]
  const ty = h * B[1]
  const tz = h * B[2]
  const t2 = tx * tx + ty * ty + tz * tz
  const sx = (2 * tx) / (1 + t2)
  const sy = (2 * ty) / (1 + t2)
  const sz = (2 * tz) / (1 + t2)
  const vx = p[3]
  const vy = p[4]
  const vz = p[5]
  // v' = v + v × t
  const px = vx + (vy * tz - vz * ty)
  const py = vy + (vz * tx - vx * tz)
  const pz = vz + (vx * ty - vy * tx)
  // v+ = v + v' × s
  p[3] = vx + (py * sz - pz * sy)
  p[4] = vy + (pz * sx - px * sz)
  p[5] = vz + (px * sy - py * sx)
  p[0] += p[3] * dt
  p[1] += p[4] * dt
  p[2] += p[5] * dt
}

/**
 * Launch an ion whose guiding centre sits at the outboard midplane, R = 1 + r0, Z = 0, with speed v and
 * pitch ratio v∥/v⊥ = ratio (sign of v∥ along B). Returns the state.
 */
export function launchIon(r0: number, v: number, ratio: number, f: TokamakField): OrbitState {
  const X = 1 + r0
  const B = tokamakB(X, 0, 0, f, new Float64Array(3))
  const Bm = Math.hypot(B[0], B[1], B[2])
  const b = [B[0] / Bm, B[1] / Bm, B[2] / Bm]
  const vperp = v / Math.sqrt(1 + ratio * ratio)
  const vpar = ratio * vperp
  // perpendicular direction: x̂ (radial) is ⊥ to b at the midplane because B_R = 0 there
  const e1 = [1, 0, 0]
  const vel = [vpar * b[0] + vperp * e1[0], vpar * b[1] + vperp * e1[1], vpar * b[2] + vperp * e1[2]]
  // particle = guiding centre + b × v⊥ / ω_c  (positive charge)
  const wc = Bm
  const off = [(b[1] * e1[2] - b[2] * e1[1]) * (vperp / wc), (b[2] * e1[0] - b[0] * e1[2]) * (vperp / wc), (b[0] * e1[1] - b[1] * e1[0]) * (vperp / wc)]
  return Float64Array.from([X + off[0], off[1], off[2], vel[0], vel[1], vel[2]])
}

/** Guiding-centre estimate X = x − b × v/ω_c, returned as [R, Z]; also v∥ = v·b. Writes into out[0..2]. */
export function guidingCentre(p: OrbitState, f: TokamakField, out: Float64Array): Float64Array {
  const B = tokamakB(p[0], p[1], p[2], f)
  const Bm = Math.sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2])
  const bx = B[0] / Bm
  const by = B[1] / Bm
  const bz = B[2] / Bm
  const k = 1 / Bm // 1/ω_c for q/m = 1
  const gx = p[0] - (by * p[5] - bz * p[4]) * k
  const gy = p[1] - (bz * p[3] - bx * p[5]) * k
  const gz = p[2] - (bx * p[4] - by * p[3]) * k
  out[0] = Math.sqrt(gx * gx + gy * gy)
  out[1] = gz
  out[2] = bx * p[3] + by * p[4] + bz * p[5]
  return out
}

/** Trapped if v∥/v⊥ < √(2ε/(1−ε)) at the outboard midplane (B ∝ 1/R, B_max/B_min = (1+ε)/(1−ε)). */
export function trappingRatio(eps: number): number {
  return Math.sqrt((2 * eps) / (1 - eps))
}

/** Full banana width between the two outboard-midplane crossings, from conservation of p_φ: Δr = 2 q v∥₀ R/(ω_c0 R₀ r). */
export function bananaWidth(r0: number, vpar0: number, q: number): number {
  return (2 * q * vpar0 * (1 + r0)) / r0
}

/**
 * Banana width without the small-orbit approximation: find the second outboard-midplane crossing r₂ from
 * energy, μ and canonical toroidal momentum p_φ = R v∥ b_φ + ψ(r) (q/m = 1, ψ = r²/2q) conservation.
 */
export function bananaWidthExact(r0: number, v: number, ratio: number, q: number): number {
  const Bmag = (R: number, r: number) => Math.sqrt(1 + (r * r) / (q * q)) / R
  const bphi = (r: number) => 1 / Math.sqrt(1 + (r * r) / (q * q))
  const psi = (r: number) => (r * r) / (2 * q)
  const R1 = 1 + r0
  const vperp = v / Math.sqrt(1 + ratio * ratio)
  const vpar = ratio * vperp
  const mu = (vperp * vperp) / (2 * Bmag(R1, r0))
  const F = (r2: number) => {
    const R2 = 1 + r2
    const v2 = Math.sqrt(Math.max(0, v * v - 2 * mu * Bmag(R2, r2)))
    return psi(r2) - psi(r0) - R1 * vpar * bphi(r0) - R2 * v2 * bphi(r2)
  }
  let a = r0
  let b = r0 + 1
  for (let i = 0; i < 100; i++) {
    const m = 0.5 * (a + b)
    if (F(m) < 0) a = m
    else b = m
  }
  return 0.5 * (a + b) - r0
}

/** Vertical ∇B + curvature drift in a purely toroidal field: v_d = (v∥² + ½v⊥²)/(ω_c R) = (v∥² + ½v⊥²)/(ω_c0 R₀). */
export function verticalDrift(vpar: number, vperp: number): number {
  return vpar * vpar + 0.5 * vperp * vperp
}

export type OrbitKind = 'trapped' | 'passing' | 'undecided'

/**
 * Tracks a running orbit: counts reversals of the (gyro-smoothed) parallel velocity and the unwrapped
 * poloidal angle of the guiding centre, and records the radii of outboard-midplane crossings.
 */
export class OrbitTracker {
  kind: OrbitKind = 'undecided'
  theta = 0 // unwrapped poloidal angle of the guiding centre
  private prevTh = 0
  private sgn = 0
  private vpar0: number
  reversals = 0
  crossings: number[] = [] // guiding-centre r at outboard midplane crossings; [0] is the launch point
  private prevZ = 0
  // the guiding-centre estimate jitters by a tiny amount at the gyro frequency, so a new midplane crossing
  // only counts after the guiding centre has moved at least zArm away from the midplane since the last one
  private zArm: number
  private armed = false
  gc = new Float64Array(3)
  constructor(p: OrbitState, f: TokamakField) {
    guidingCentre(p, f, this.gc)
    this.vpar0 = this.gc[2]
    this.sgn = Math.sign(this.vpar0) || 1
    this.prevTh = Math.atan2(this.gc[1], this.gc[0] - 1)
    this.prevZ = this.gc[1]
    const B = tokamakB(p[0], p[1], p[2], f)
    const rho = Math.hypot(p[3], p[4], p[5]) / Math.hypot(B[0], B[1], B[2]) // Larmor radius bound (q/m = 1)
    this.zArm = 0.2 * rho
    this.crossings.push(Math.hypot(this.gc[0] - 1, this.gc[1]))
  }
  update(p: OrbitState, f: TokamakField) {
    const g = guidingCentre(p, f, this.gc)
    const th = Math.atan2(g[1], g[0] - 1)
    let d = th - this.prevTh
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    this.theta += d
    this.prevTh = th
    // hysteresis: v∥ must swing past half its launch value the other way to count as a reversal
    const thr = 0.5 * Math.abs(this.vpar0)
    if (this.sgn > 0 && g[2] < -thr) {
      this.sgn = -1
      this.reversals++
    } else if (this.sgn < 0 && g[2] > thr) {
      this.sgn = 1
      this.reversals++
    }
    if (Math.abs(g[1]) > this.zArm) this.armed = true
    if (this.armed && g[0] > 1 && ((this.prevZ < 0 && g[1] >= 0) || (this.prevZ > 0 && g[1] <= 0))) {
      this.crossings.push(Math.hypot(g[0] - 1, g[1]))
      this.armed = false
    }
    this.prevZ = g[1]
    if (this.kind === 'undecided') {
      if (this.reversals >= 1) this.kind = 'trapped'
      else if (Math.abs(this.theta) >= 2 * Math.PI) this.kind = 'passing'
    }
  }
}

/**
 * Trapped or passing from the exact guiding-centre invariants (energy, μ and p_φ = ψ + R v∥ b_φ), which keeps
 * the finite width of the orbit. The thin-orbit condition v∥/v⊥ < √(2ε/(1−ε)) assumes the particle stays on
 * its launch flux surface; a fat orbit instead drifts to other radii, where the mirror ratio differs. This follows
 * the guiding-centre orbit from the outboard midplane (θ = 0) toward the inboard midplane (θ = π): if the branch
 * with the launch sign of v∥ reaches θ = π the ion is passing, otherwise it turns back (trapped).
 */
export function isTrappedExact(r0: number, v: number, ratio: number, q: number, nTheta = 180, nR = 400): boolean {
  const Bmag = (R: number, r: number) => Math.sqrt(1 + (r * r) / (q * q)) / R
  const bphi = (r: number) => 1 / Math.sqrt(1 + (r * r) / (q * q))
  const psi = (r: number) => (r * r) / (2 * q)
  const vperp = v / Math.sqrt(1 + ratio * ratio)
  const vpar = ratio * vperp
  const mu = (vperp * vperp) / (2 * Bmag(1 + r0, r0))
  const P = psi(r0) + (1 + r0) * vpar * bphi(r0)
  // search a window around the current radius, scaled to the expected banana width 2qv∥R/r (and at least the orbit's Larmor scale)
  const w = Math.min(0.3, 6 * q * v * (1 + r0) / r0 + 1e-6)
  // G(r, θ) = v∥(r, θ)² + 2μB − v², with v∥ fixed by p_φ; only roots where v∥ keeps its launch sign count
  const G = (r: number, th: number) => {
    const R = 1 + r * Math.cos(th)
    const vp = (P - psi(r)) / (R * bphi(r))
    return vp * vp + 2 * mu * Bmag(R, r) - v * v
  }
  const sameSign = (r: number) => (P - psi(r)) * (vpar >= 0 ? 1 : -1) > 0
  let rPrev = r0
  for (let i = 1; i <= nTheta; i++) {
    const th = (Math.PI * i) / nTheta
    let best = NaN
    const lo = Math.max(0, rPrev - w)
    const dr = (rPrev + w - lo) / nR
    let gPrev = G(lo, th)
    for (let j = 1; j <= nR; j++) {
      const r = lo + dr * j
      const g = G(r, th)
      if ((gPrev <= 0) !== (g <= 0)) {
        const rr = r - dr * (g / (g - gPrev))
        if (sameSign(rr) && (isNaN(best) || Math.abs(rr - rPrev) < Math.abs(best - rPrev))) best = rr
      }
      gPrev = g
    }
    // the branch must continue smoothly; a jump means we have left the launch branch
    if (isNaN(best) || Math.abs(best - rPrev) > w / 6) return true
    rPrev = best
  }
  return false
}
