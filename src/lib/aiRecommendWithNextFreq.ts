// lib/aiRecommendWithNextFreq.ts
import { PremiumLottoRecord } from "./premiumCache";
import { analyzePremiumRound, PremiumAnalysisResult } from "./premiumAnalyzer";
import { normalizeScores } from "../utils/normalizeScore";
import { AiFeatureHelper } from "./aiFeatures";
import { sortedLottoCache } from "../lib/lottoCache";
import { OptimizedLottoNumber } from "../types/lotto";

export interface WeightConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq?: number; // 이전회차 → 다음회차 연관성 가중치
}

export interface NumberScoreDetail {
  num: number;
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq: number; // 이번에 추가
  final: number;
}

export interface AIRecommendResult {
  combination: number[];
  details: NumberScoreDetail[];
  scores: NumberScoreDetail[];
  nextRound?: {
    round: number;
    numbers: number[];
    bonus: number;
  } | null;
}

const getNumbers = (item: OptimizedLottoNumber) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
];

/**
 * 추천 조합 생성
 * @param rounds 과거 회차 데이터
 * @param weight 가중치
 */
export async function recommendAIWithNextFreq(
  rounds: PremiumLottoRecord[],
  weight: WeightConfig,
  clusterUnit: number = 5 // 기본값 유지
): Promise<AIRecommendResult> {
  const selectedRound = rounds[rounds.length - 1].drwNo;
  const analysis: PremiumAnalysisResult = await analyzePremiumRound(
    selectedRound,
    false,
    20
  );

  const nextFreqMap = analysis.perNumberNextFreq;
  const rawScoreList: NumberScoreDetail[] = [];
  const helper = new AiFeatureHelper(rounds);

  for (let num = 1; num <= 45; num++) {
    const hot = helper.getHot(num);
    const cold = helper.getCold(num);
    const streak = helper.getStreakSimple(num);
    const pattern = helper.getPatternComplex(num);

    // 🔥 clusterUnit 반영
    const cluster = helper.getCluster(num, clusterUnit);

    const random = Math.random();

    let nextFreqScore = 0;
    for (const prevNum of helper.latest.numbers) {
      nextFreqScore += nextFreqMap[prevNum]?.[num] ?? 0;
    }

    const final =
      hot * weight.hot +
      cold * weight.cold +
      streak * weight.streak +
      pattern * weight.pattern +
      cluster * weight.cluster +
      random * weight.random +
      nextFreqScore * (weight.nextFreq ?? 1);

    rawScoreList.push({
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

  const normalizedMap = normalizeScores(
    Object.fromEntries(rawScoreList.map((s) => [s.num, s.final]))
  );

  const scoreList = rawScoreList.map((s) => ({
    ...s,
    final: normalizedMap[s.num],
  }));

  const top20 = [...scoreList].sort((a, b) => b.final - a.final).slice(0, 20);
  const picked = top20.slice(0, 6);

  const checkNextRound = sortedLottoCache.find(
    (rec) => selectedRound + 1 === rec.drwNo
  );
  const nextRound = checkNextRound
    ? {
        round: checkNextRound.drwNo,
        numbers: getNumbers(checkNextRound),
        bonus: Number(checkNextRound.bnusNo),
      }
    : null;

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores: scoreList,
    nextRound: nextRound ?? null,
  };
}
