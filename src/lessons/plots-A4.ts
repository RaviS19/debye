// Plotter presets for A4 (plasmas as fluids).
import type { PlotSpec } from '../components/Plotter'
import { COLORS } from '../components/useCanvas'
import { e, mp } from '../physics/constants'

/** Diamagnetic drift speed kT/(eBL) in m/s, T in eV (kT/e is T in volts). */
const vD = (TeV: number, B: number, L: number) => TeV / (B * L)

export const PLOTS: PlotSpec[] = [
  {
    id: 'a4-diamagnetic-drift',
    title: 'Diamagnetic drift speed vs gradient length',
    equation: 'v_D = \\dfrac{kT}{eB}\\,\\dfrac{1}{L_n}, \\qquad L_n = \\dfrac{n}{|\\nabla n|}',
    blurb: 'Each line is one temperature, with uniform T. Steeper gradients (small L_n) and hotter plasma give faster diamagnetic flow; a stronger field slows it. Ions and electrons at the same temperature drift at the same speed in opposite directions, so their currents add.',
    x: { label: 'gradient length L_n (m)', min: 1e-4, max: 10, log: true },
    y: { label: 'v_D (m/s)', min: 1e-1, max: 1e8, log: true },
    params: [
      { key: 'B', label: 'Magnetic field', min: 0.01, max: 10, value: 1, log: true, unit: 'T' },
      { key: 'T', label: 'Your temperature', min: 0.1, max: 1e5, value: 5, log: true, unit: 'eV' },
    ],
    curves: [
      { label: 'T = 10 eV', color: COLORS.violet, fn: (L, p) => vD(10, p.B, L) },
      { label: 'T = 1 keV', color: COLORS.magenta, fn: (L, p) => vD(1000, p.B, L) },
      { label: 'your T', color: COLORS.cyan, fn: (L, p) => vD(p.T, p.B, L) },
    ],
  },
  {
    id: 'a4-drift-compare',
    title: 'Diamagnetic vs E×B drift vs thermal speed',
    equation: 'v_D = \\dfrac{kT_i}{eBL}, \\qquad v_E = \\dfrac{E}{B}',
    blurb: 'For hydrogen ions. The diamagnetic drift is smaller than the ion thermal speed by the ratio ρ_i/L, which is why it is a slow fluid drift in any well-magnetized plasma. Where the lines cross (L = ρ_i) the fluid picture breaks down. If the electric field is set up by the pressure gradient itself (Boltzmann electrons, E ≈ kT_e/eL), then v_E and v_D are the same size.',
    x: { label: 'gradient length L (m)', min: 1e-5, max: 10, log: true },
    y: { label: 'speed (m/s)', min: 1, max: 1e8, log: true },
    params: [
      { key: 'T', label: 'Ion temperature', min: 0.1, max: 1e5, value: 5, log: true, unit: 'eV' },
      { key: 'B', label: 'Magnetic field', min: 0.01, max: 10, value: 1, log: true, unit: 'T' },
      { key: 'E', label: 'Electric field', min: 1, max: 1e6, value: 1e4, log: true, unit: 'V/m' },
    ],
    curves: [
      { label: 'ion diamagnetic v_D', color: COLORS.magenta, fn: (L, p) => vD(p.T, p.B, L) },
      { label: 'E×B drift v_E', color: COLORS.cyan, fn: (_L, p) => p.E / p.B },
      { label: 'ion thermal speed √(kT/M)', color: COLORS.violet, dashed: true, fn: (_L, p) => Math.sqrt((p.T * e) / mp) },
    ],
    markers: [{ label: 'L = ρ_i', color: COLORS.amber, x: (p) => Math.sqrt((p.T * e) / mp) / ((e * p.B) / mp) }],
  },
  {
    id: 'a4-boltzmann',
    title: 'Boltzmann relation for electrons',
    equation: 'n_e = n_0 \\exp\\!\\left(\\dfrac{e\\phi}{kT_e}\\right)',
    blurb: 'Electron density along a field line versus the local potential. Every kT_e/e volts of potential changes the density by a factor e ≈ 2.7. Cold electrons respond to tiny potentials; hot electrons need large ones.',
    x: { label: 'potential φ (V)', min: -50, max: 50 },
    y: { label: 'n_e / n_0', min: 1e-3, max: 1e3, log: true },
    params: [{ key: 'T', label: 'Your electron temperature', min: 0.5, max: 100, value: 5, log: true, unit: 'eV' }],
    curves: [
      { label: 'T_e = 2 eV', color: COLORS.violet, fn: (phi) => Math.exp(phi / 2) },
      { label: 'T_e = 20 eV', color: COLORS.magenta, fn: (phi) => Math.exp(phi / 20) },
      { label: 'your T_e', color: COLORS.cyan, fn: (phi, p) => Math.exp(phi / p.T) },
    ],
    markers: [{ label: 'φ = kT_e/e', color: COLORS.amber, x: (p) => p.T }],
  },
]
