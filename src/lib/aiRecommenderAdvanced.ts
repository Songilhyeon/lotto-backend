// aiRecommenderAdvanced.ts
import { analyzePremiumRound, PremiumAnalysisResult } from "./premiumAnalyzer";
import { sortedLottoCache } from "../lib/lottoCache";
import { getNumbers } from "../utils/lottoNumberUtils";
import { normalizeScores } from "../utils/normalizeScores";
import { NumberScoreDetail } from "../types/api";
import { getPremiumRound } from "../lib/premiumCache";

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

export interface AiRecommendation {
  combination: number[];
  details: NumberScoreDetail[];
  scores: NumberScoreDetail[];
  seed: number;
  nextRound?: {
    round: number;
    numbers: number[];
    bonus: number;
  } | null;
}

/* ---------- Seeded Random ---------- */

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

/* ---------- Presets ---------- */

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

/* ---------- Advanced AI ---------- */

export async function getAiRecommendationAdvanced(
  round: number,
  preset: AiPreset,
  clusterUnit: number = 5,
  seed: number = Date.now(),
  customWeights?: WeightConfig
): Promise<AiRecommendation> {
  const analysis: PremiumAnalysisResult = await analyzePremiumRound(
    round,
    false,
    100
  );
  const randomGen = new SeededRandom(seed);
  const weight = customWeights ?? preset.weight;

  const rawScores: Omit<NumberScoreDetail, "final">[] = [];

  for (let num = 1; num <= 45; num++) {
    // 1. Hot: 최근 N회 출현 빈도 (높을수록 자주 나온 번호)
    const hot = analysis.recentFreq[num] ?? 0;

    // 2. Cold: 마지막 출현 이후 경과 회차 (높을수록 오래 안 나온 번호)
    const lastRound = analysis.lastAppearance[num] ?? 0;
    const cold = lastRound > 0 ? round - lastRound : round;

    // 3. Streak: 최근 연속 출현 횟수 (높을수록 연속으로 나온 번호)
    const streak = analysis.consecutiveAppearances[num] ?? 0;

    // 4. Pattern: K-match 기반 다음 회차 출현 빈도 총합
    // (타겟 회차와 1개, 2개, 3개, 4개 이상 일치하는 과거 회차들의 다음 회차 출현 빈도)
    const pattern =
      (analysis.kMatchNextFreq["1"][num] ?? 0) +
      (analysis.kMatchNextFreq["2"][num] ?? 0) +
      (analysis.kMatchNextFreq["3"][num] ?? 0) +
      (analysis.kMatchNextFreq["4+"][num] ?? 0);

    // 5. Cluster: 단위별 패턴 다음 회차 빈도
    // (구간별 번호 개수가 같은 패턴의 다음 회차 출현 빈도)
    let cluster = 0;
    if (clusterUnit === 5) {
      cluster = analysis.pattern5NextFreq[num] ?? 0;
    } else if (clusterUnit === 7) {
      cluster = analysis.pattern7NextFreq[num] ?? 0;
    } else if (clusterUnit === 10) {
      cluster = analysis.pattern10NextFreq[num] ?? 0;
    }

    // 6. Random: 무작위성 추가 (가중치 > 0일 때만 계산)
    const random = weight.random > 0 ? randomGen.next() : 0;

    // 7. NextFreq: 이번 회차 당첨 번호들이 나왔을 때 다음 회차 출현 빈도
    // (현재 회차의 당첨 번호 각각에 대해, 그 번호가 과거에 나왔을 때
    //  다음 회차에 num이 나온 빈도를 모두 합산)
    let nextFreqScore = 0;
    const latestNumbers = getPremiumRound(round)?.numbers || [];
    for (const prevNum of latestNumbers) {
      nextFreqScore += analysis.perNumberNextFreq[prevNum]?.[num] ?? 0;
    }

    // 최종 점수 계산 (가중합)
    const finalRaw =
      hot * weight.hot +
      cold * weight.cold +
      streak * weight.streak +
      pattern * weight.pattern +
      cluster * weight.cluster +
      random * weight.random +
      nextFreqScore * (weight.nextFreq ?? 1);

    rawScores.push({
      num,
      hot,
      cold,
      streak,
      pattern,
      cluster,
      random,
      nextFreq: nextFreqScore,
      finalRaw,
    });
  }

  /* ---------- Normalize (UI용) ---------- */

  const finalNormMap = normalizeScores(
    Object.fromEntries(rawScores.map((s) => [s.num, s.finalRaw]))
  );

  const scores: NumberScoreDetail[] = rawScores.map((s) => ({
    ...s,
    final: finalNormMap[s.num],
  }));

  const picked = [...scores].sort((a, b) => b.final - a.final).slice(0, 6);

  const checkNextRound = sortedLottoCache.find((r) => r.drwNo === round + 1);
  const nextRound = checkNextRound
    ? {
        round: checkNextRound.drwNo,
        numbers: getNumbers(checkNextRound),
        bonus: checkNextRound.bnusNo,
      }
    : null;

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores,
    nextRound,
    seed,
  };
}
