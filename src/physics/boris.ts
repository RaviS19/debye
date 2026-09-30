// Boris particle pusher: the standard integrator for charged particles in E and B.
// It rotates velocity exactly around B, so gyration keeps its energy for any dt.

export type Vec3 = [number, number, number]

export interface Particle {
  x: Vec3
  v: Vec3
  q: number
  m: number
}

export type FieldFn = (x: Vec3, t: number) => { E: Vec3; B: Vec3 }

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Advance one particle by dt in place. */
export function borisStep(p: Particle, field: FieldFn, t: number, dt: number): void {
  const { E, B } = field(p.x, t)
  const k = (p.q / p.m) * (dt / 2)
  const vm: Vec3 = [p.v[0] + k * E[0], p.v[1] + k * E[1], p.v[2] + k * E[2]]
  const tv: Vec3 = [k * B[0], k * B[1], k * B[2]]
  const t2 = dot(tv, tv)
  const s: Vec3 = [(2 * tv[0]) / (1 + t2), (2 * tv[1]) / (1 + t2), (2 * tv[2]) / (1 + t2)]
  const c1 = cross(vm, tv)
  const vp: Vec3 = [vm[0] + c1[0], vm[1] + c1[1], vm[2] + c1[2]]
  const c2 = cross(vp, s)
  const vplus: Vec3 = [vm[0] + c2[0], vm[1] + c2[1], vm[2] + c2[2]]
  p.v = [vplus[0] + k * E[0], vplus[1] + k * E[1], vplus[2] + k * E[2]]
  p.x = [p.x[0] + p.v[0] * dt, p.x[1] + p.v[1] * dt, p.x[2] + p.v[2] * dt]
}

/** Magnetic mirror field, normalized: Bz = B0(1 + z²/L²), Br = −(r/2) dBz/dz (keeps ∇·B = 0). */
export function mirrorField(B0: number, L: number): FieldFn {
  return (x) => {
    const [px, py, pz] = x
    const g = (B0 * pz) / (L * L)
    return { E: [0, 0, 0], B: [-px * g, -py * g, B0 * (1 + (pz * pz) / (L * L))] }
  }
}

/** Mirror half-length z_m that gives mirror ratio R for a field of scale L. */
export function mirrorZmax(R: number, L: number): number {
  return L * Math.sqrt(R - 1)
}

/**
 * Orbit-sandbox field: B along z with a linear gradient in x, uniform E in the plane,
 * plus an optional uniform "gravity" g (entered as a force per unit mass).
 */
export function sandboxField(B0: number, gradB: number, Ex: number, Ey: number): FieldFn {
  return (x) => ({ E: [Ex, Ey, 0], B: [0, 0, B0 * (1 + gradB * x[0])] })
}
