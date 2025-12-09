// ai/AI_Recommender_Independent.ts
import { getPremiumRange } from "./premiumCache";
import { AiFeatureHelper } from "./aiFeatures";

// 고급 개선 버전 — 독립 Feature 합산형 추천기

export interface IndependentConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  density: number;
  decay: number;
  noise: number;
}

export async function recommendAIIndependent(
  round: number,
  weight: IndependentConfig,
  seed: number = Date.now()
) {
  const rounds = getPremiumRange(1, round);

  // Seeded Noise Generator
  let s = seed % 2147483647;
  const random = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const helper = new AiFeatureHelper(rounds);
  const features = [];

  for (let num = 1; num <= 45; num++) {
    const hot = helper.getHot(num);
    const cold = helper.getCold(num);
    const streakRun = helper.getStreakRun(num);
    const patternScore = helper.getPatternSimple(num);
    const density = helper.getDensity(num);
    const decayScore = helper.getDecay(num);
    const noise = random();

    const final =
      hot * weight.hot +
      cold * weight.cold +
      streakRun * weight.streak +
      patternScore * weight.pattern +
      density * weight.density +
      decayScore * weight.decay +
      noise * weight.noise;

    features.push({
      num,
      hot,
      cold,
      streakRun,
      patternScore,
      density,
      decayScore,
      noise,
      final,
    });
  }

  const picked = [...features].sort((a, b) => b.final - a.final).slice(0, 6);

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores: features,
    seed,
  };
}
