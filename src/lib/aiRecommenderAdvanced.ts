// aiRecommenderAdvanced.ts
import { analyzePremiumRound, PremiumAnalysisResult } from "./premiumAnalyzer";

export interface WeightConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq?: number;
}

export interface AiPreset {
  name: string;
  weight: WeightConfig;
}

export interface NumberScoreDetail {
  num: number;
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq: number;
  final: number;
}

export interface AiRecommendation {
  combination: number[];
  details: NumberScoreDetail[];
  scores: NumberScoreDetail[];
  seed: number;
}

// -----------------------------
// Seeded Random 구현
// -----------------------------
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

// -----------------------------
// Preset 예시
// -----------------------------
export const AiPresets: AiPreset[] = [
  {
    name: "안정형",
    weight: {
      hot: 2,
      cold: 1,
      streak: 1,
      pattern: 1,
      cluster: 1,
      random: 0,
      nextFreq: 2,
    },
  },
  {
    name: "고위험형",
    weight: {
      hot: 1,
      cold: 2,
      streak: 1,
      pattern: 2,
      cluster: 1,
      random: 1,
      nextFreq: 1,
    },
  },
  {
    name: "패턴형",
    weight: {
      hot: 1,
      cold: 1,
      streak: 1,
      pattern: 3,
      cluster: 2,
      random: 0,
      nextFreq: 2,
    },
  },
];

// -----------------------------
// AI 추천 생성 함수
// -----------------------------
export async function getAiRecommendationAdvanced(
  round: number,
  preset: AiPreset,
  clusterUnit: number = 5,
  seed: number = Date.now(),
  customWeights?: WeightConfig // 새로 추가
): Promise<AiRecommendation> {
  const analysis: PremiumAnalysisResult = await analyzePremiumRound(
    round,
    false,
    20
  );

  const randomGen = new SeededRandom(seed);
  const latestRoundNo = analysis.round;
  const nextFreqMap = analysis.perNumberNextFreq;
  const scores: NumberScoreDetail[] = [];

  // 사용자가 보낸 커스텀 weight가 있으면 그것을 쓰고, 없으면 preset weight 사용
  const weight = customWeights ?? preset.weight;

  for (let num = 1; num <= 45; num++) {
    const hot = Object.values(nextFreqMap).reduce(
      (acc, nf) => acc + (nf[num] ?? 0),
      0
    );
    const cold = 45 - hot;
    const streak = latestRoundNo % 2 === num % 2 ? 1 : 0;
    const pattern = (num % 10) / 9;
    const cluster = Math.floor((num - 1) / clusterUnit);
    const random = randomGen.next();
    const nextFreqScore = hot;

    const final =
      hot * weight.hot +
      cold * weight.cold +
      streak * weight.streak +
      pattern * weight.pattern +
      cluster * weight.cluster +
      random * weight.random +
      nextFreqScore * (weight.nextFreq ?? 1);

    scores.push({
      num,
      hot,
      cold,
      streak,
      pattern,
      cluster,
      random,
      nextFreq: nextFreqScore,
      final,
    });
  }

  const maxFinal = Math.max(...scores.map((s) => s.final));
  const minFinal = Math.min(...scores.map((s) => s.final));
  scores.forEach((s) => {
    s.final = ((s.final - minFinal) / (maxFinal - minFinal)) * 100;
  });

  const picked = [...scores].sort((a, b) => b.final - a.final).slice(0, 6);

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores,
    seed,
  };
}
