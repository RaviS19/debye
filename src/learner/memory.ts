// Personal memory curve on top of FSRS.
//
// FSRS predicts the chance you still remember a card t days after a review, R(t, S) = (1 + F t/S)^(-d),
// where S is the card's stability and d, F come from the default parameters. People differ: some forget
// faster than the default curve, some slower. We fit one number k per learner, "your stability is k times
// what FSRS assumes", by maximum likelihood over your real reviews (with a gentle prior at k = 1 so a few
// reviews cannot swing it far). Then we move the scheduler's retention target so cards come back at the
// moment YOUR recall hits the retention you asked for: k < 1 brings cards back sooner, k > 1 spaces them out.
import { forgetting_curve } from 'ts-fsrs'
import type { ReviewEntry } from '../store/store'

export interface MemoryModel {
  /** reviews usable for the fit (cards in the review state, at least half a day since the last review) */
  n: number
  /** your stability relative to the FSRS default (1 = average) */
  k: number
  /** true once there are enough reviews for k to mean something */
  personal: boolean
  desired: number
  /** retention target handed to the scheduler so your real recall lands on `desired` */
  effectiveRetention: number
  observed: number
  predicted: number
  bins: { lo: number; hi: number; n: number; predicted: number; observed: number }[]
}

const MIN_REVIEWS = 12
const PRIOR_SD = 0.6 // in ln k

export function usableReviews(log: ReviewEntry[]) {
  // state before review: 2 = Review, 3 = Relearning; skip same-day learning steps
  return log.filter((r) => (r[6] === 2 || r[6] === 3) && r[3] >= 0.5 && r[4] > 0)
}

export function decayFactor(w: readonly number[]) {
  const decay = -w[20]
  const factor = Math.pow(0.9, 1 / decay) - 1
  return { decay, factor }
}

/** Retention target that makes the default scheduler space cards as if stability were k times larger. */
export function shiftedRetention(desired: number, k: number, w: readonly number[]) {
  const { decay } = decayFactor(w)
  const r = Math.pow(1 + k * (Math.pow(desired, 1 / decay) - 1), decay)
  return Math.min(0.97, Math.max(0.7, r))
}

export function fitK(data: { t: number; S: number; ok: boolean }[], w: readonly number[]) {
  let best = 1
  let bestLL = -Infinity
  for (let i = 0; i <= 160; i++) {
    const k = Math.exp(Math.log(0.2) + (i / 160) * (Math.log(5) - Math.log(0.2)))
    let ll = -(Math.log(k) ** 2) / (2 * PRIOR_SD * PRIOR_SD)
    for (const d of data) {
      const p = Math.min(0.999, Math.max(0.001, forgetting_curve(w as number[], d.t, k * d.S)))
      ll += d.ok ? Math.log(p) : Math.log(1 - p)
    }
    if (ll > bestLL) {
      bestLL = ll
      best = k
    }
  }
  return best
}

export function memoryModel(log: ReviewEntry[], desired: number, w: readonly number[]): MemoryModel {
  const use = usableReviews(log)
  const data = use.map((r) => ({ t: r[3], S: r[4], ok: r[2] > 1 }))
  const personal = data.length >= MIN_REVIEWS
  const k = personal ? fitK(data, w) : 1
  const edges = [0, 0.7, 0.8, 0.9, 1.0001]
  const bins = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1]
    const inBin = use.filter((r) => r[5] >= lo && r[5] < hi)
    return {
      lo,
      hi: Math.min(hi, 1),
      n: inBin.length,
      predicted: inBin.length ? inBin.reduce((a, r) => a + r[5], 0) / inBin.length : NaN,
      observed: inBin.length ? inBin.filter((r) => r[2] > 1).length / inBin.length : NaN,
    }
  })
  return {
    n: data.length,
    k,
    personal,
    desired,
    effectiveRetention: personal ? shiftedRetention(desired, k, w) : desired,
    observed: data.length ? data.filter((d) => d.ok).length / data.length : NaN,
    predicted: use.length ? use.reduce((a, r) => a + r[5], 0) / use.length : NaN,
    bins,
  }
}
