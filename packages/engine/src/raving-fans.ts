/**
 * Raving Fans (Force 7): the promises a business makes to clients, whether
 * each was actually delivered, and a composite score blending promise
 * delivery with retention/referral rates the user enters. Pure scoring, no
 * tracking — this is a self-assessment lens, not measured behaviour.
 */
export interface ClientPromise {
  id: string;
  promise: string;
  delivered: boolean;
  createdAt: string;
}

export interface PromiseSummary {
  total: number;
  delivered: number;
  rate: number | null; // null when there are no promises logged yet
}

export function summarizePromises(promises: ClientPromise[]): PromiseSummary {
  const total = promises.length;
  const delivered = promises.filter((p) => p.delivered).length;
  return { total, delivered, rate: total === 0 ? null : delivered / total };
}

export interface RavingFansInputs {
  retentionRate: number; // 0..1
  referralRate: number;  // 0..1
}

export type RavingFansBand = "building" | "solid" | "raving";

export interface RavingFansScore {
  promiseDeliveryRate: number | null;
  score: number; // 0..100
  band: RavingFansBand;
}

/** Blends promise delivery (40%) with retention (30%) and referral (30%);
 *  redistributes the promise weight evenly across the other two when there
 *  are no promises logged yet, rather than silently scoring it as zero. */
export function computeRavingFansScore(promises: ClientPromise[], inputs: RavingFansInputs): RavingFansScore {
  const { rate } = summarizePromises(promises);
  const weights = rate === null
    ? { promise: 0, retention: 0.5, referral: 0.5 }
    : { promise: 0.4, retention: 0.3, referral: 0.3 };

  const score = Math.round(
    (weights.promise * (rate ?? 0) + weights.retention * inputs.retentionRate + weights.referral * inputs.referralRate) * 100,
  );

  const band: RavingFansBand = score >= 75 ? "raving" : score >= 45 ? "solid" : "building";
  return { promiseDeliveryRate: rate, score, band };
}
