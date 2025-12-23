import { PremiumLottoRecord } from "./premiumCache";
import { analyzePremiumRound, PremiumAnalysisResult } from "./premiumAnalyzer";
import { normalizeScores } from "../utils/normalizeScores";
import { AiFeatureHelper } from "./aiFeatures";
import { sortedLottoCache } from "../lib/lottoCache";
import { OptimizedLottoNumber } from "../types/lotto";
import { NumberScoreDetail } from "../types/api";

export interface WeightConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq?: number;
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

export async function recommendAIWithNextFreq(
  rounds: PremiumLottoRecord[],
  weight: WeightConfig,
  clusterUnit: number = 5
): Promise<AIRecommendResult> {
  const selectedRound = rounds[rounds.length - 1].drwNo;

  const analysis: PremiumAnalysisResult = await analyzePremiumRound(
    selectedRound,
    false,
    20
  );

  const nextFreqMap = analysis.perNumberNextFreq;
  const helper = new AiFeatureHelper(rounds);

  /* -------------------------
   * 1️⃣ Raw 점수 계산
   * ------------------------- */
  const rawScoreList: Omit<NumberScoreDetail, "final">[] = [];

  for (let num = 1; num <= 45; num++) {
    const hot = helper.getHot(num);
    const cold = helper.getCold(num);
    const streak = helper.getStreakSimple(num);
    const pattern = helper.getPatternComplex(num);
    const cluster = helper.getCluster(num, clusterUnit);
    const random = Math.random();

    let nextFreqScore = 0;
    for (const prevNum of helper.latest.numbers) {
      nextFreqScore += nextFreqMap[prevNum]?.[num] ?? 0;
    }

    const finalRaw =
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
      finalRaw,
    });
  }

  /* -------------------------
   * 2️⃣ 정규화 (UI용)
   * ------------------------- */
  const normalizedMap = normalizeScores(
    Object.fromEntries(rawScoreList.map((s) => [s.num, s.finalRaw]))
  );

  const scores: NumberScoreDetail[] = rawScoreList.map((s) => ({
    ...s,
    final: normalizedMap[s.num] ?? 0,
  }));

  /* -------------------------
   * 3️⃣ 추천 번호
   * ------------------------- */
  const picked = [...scores].sort((a, b) => b.final - a.final).slice(0, 6);

  /* -------------------------
   * 4️⃣ 다음 회차
   * ------------------------- */
  const checkNextRound = sortedLottoCache.find(
    (rec) => rec.drwNo === selectedRound + 1
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
    scores,
    nextRound,
  };
}
