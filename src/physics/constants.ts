// SI constants (CODATA 2018) and the handful of plasma formulas the lessons use.

export const e = 1.602176634e-19 // elementary charge, C
export const me = 9.1093837015e-31 // electron mass, kg
export const mp = 1.67262192369e-27 // proton mass, kg
export const eps0 = 8.8541878128e-12 // vacuum permittivity, F/m
export const c = 2.99792458e8 // speed of light, m/s

/** Debye length in metres. n in m^-3, Te in eV. */
export function debyeLength(n: number, TeV: number): number {
  return Math.sqrt((eps0 * TeV * e) / (n * e * e))
}

/** Electron plasma frequency ω_pe in rad/s. n in m^-3. */
export function plasmaFrequency(n: number, m = me): number {
  return Math.sqrt((n * e * e) / (eps0 * m))
}

/** Number of particles in a Debye sphere, N_D = (4/3)π n λ_D³. */
export function plasmaParameter(n: number, TeV: number): number {
  return (4 / 3) * Math.PI * n * debyeLength(n, TeV) ** 3
}

/** Cyclotron frequency ω_c = |q|B/m in rad/s. */
export function cyclotronFrequency(B: number, m = me, q = e): number {
  return (Math.abs(q) * B) / m
}

/** Larmor radius r_L = m v⊥ / (|q| B) in metres. */
export function larmorRadius(vPerp: number, B: number, m = me, q = e): number {
  return (m * vPerp) / (Math.abs(q) * B)
}

/** Loss-cone half angle in radians for mirror ratio R = Bmax/Bmin. */
export function lossConeAngle(R: number): number {
  return Math.asin(Math.sqrt(1 / R))
}

/** Fraction of an isotropic distribution inside the two loss cones: 1 − cos θ_m. */
export function lossFraction(R: number): number {
  return 1 - Math.cos(lossConeAngle(R))
}

/** Compact engineering notation, e.g. 2.35e-5 → "2.35×10⁻⁵". */
export function sci(x: number, digits = 3): string {
  if (x === 0 || !isFinite(x)) return String(x)
  const exp = Math.floor(Math.log10(Math.abs(x)))
  if (exp >= -2 && exp <= 3) return x.toPrecision(digits).replace(/\.?0+$/, '')
  const mant = x / 10 ** exp
  const sup = String(exp).replace(/[-0-9]/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)])
  return `${mant.toPrecision(digits)}×10${sup}`
}
