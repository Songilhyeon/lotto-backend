// ai/AI_Recommender_Independent.ts
import { getPremiumRange } from "./premiumCache";
import { AiFeatureHelper } from "./aiFeatures";
import { normalizeScores } from "../utils/normalizeScores";

// 고급 개선 버전 — 독립 Feature 합산형 점수계산기

export interface IndependentConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  density: number;
  decay: number;
  noise: number;
}

interface IndependentRawConfig {
  num: number;
  hot: number;
  cold: number;
  streakRun: number;
  patternScore: number;
  density: number;
  decayScore: number;
  noise: number;
}

export async function recommendAIIndependent(
  round: number,
  weight: IndependentConfig,
  seed: number = Date.now()
) {
  const rounds = getPremiumRange(1, round);
  const helper = new AiFeatureHelper(rounds);

  // -------------------------
  // Seeded Random
  // -------------------------
  let s = seed % 2147483647;
  const random = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // -------------------------
  // 1️⃣ Raw feature 수집
  // -------------------------
  const raw: IndependentRawConfig[] = [];

  for (let num = 1; num <= 45; num++) {
    raw.push({
      num,
      hot: helper.getHot(num),
      cold: helper.getCold(num),
      streakRun: helper.getStreakRun(num),
      patternScore: helper.getPatternSimple(num),
      density: helper.getDensity(num),
      decayScore: helper.getDecay(num),
      noise: random(),
    });
  }

  // -------------------------
  // 2️⃣ feature별 normalize
  // -------------------------
  const normalizeBy = (key: keyof IndependentRawConfig) =>
    normalizeScores(
      Object.fromEntries(raw.map((r) => [r.num, r[key] as number]))
    );

  const hotN = normalizeBy("hot");
  const coldN = normalizeBy("cold");
  const streakN = normalizeBy("streakRun");
  const patternN = normalizeBy("patternScore");
  const densityN = normalizeBy("density");
  const decayN = normalizeBy("decayScore");
  const noiseN = normalizeBy("noise");

  // -------------------------
  // 3️⃣ Final 점수 계산 (raw)
  // -------------------------
  const scores = raw.map((r) => {
    const finalRaw =
      hotN[r.num] * weight.hot +
      coldN[r.num] * weight.cold +
      streakN[r.num] * weight.streak +
      patternN[r.num] * weight.pattern +
      densityN[r.num] * weight.density +
      decayN[r.num] * weight.decay +
      noiseN[r.num] * weight.noise;

    return {
      ...r,
      finalRaw, // ✅ raw 점수
    };
  });

  // -------------------------
  // 4️⃣ final 점수 normalize (UI용)
  // -------------------------
  const finalNormalized = normalizeScores(
    Object.fromEntries(scores.map((s) => [s.num, s.finalRaw]))
  );

  const scoresWithNormalized = scores.map((s) => ({
    ...s,
    final: finalNormalized[s.num], // ✅ UI용 0~100
  }));

  const picked = [...scoresWithNormalized]
    .sort((a, b) => b.finalRaw - a.finalRaw)
    .slice(0, 6);

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores: scoresWithNormalized,
    seed,
  };
}
