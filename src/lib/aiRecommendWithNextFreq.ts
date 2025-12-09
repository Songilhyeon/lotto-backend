// lib/aiRecommendWithNextFreq.ts
import { PremiumLottoRecord } from "./premiumCache";
import { analyzePremiumRound, PremiumAnalysisResult } from "./premiumAnalyzer";
import { normalizeScores } from "../utils/normalizeScore";
import { AiFeatureHelper } from "./aiFeatures";

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
}

/**
 * 추천 조합 생성
 * @param rounds 과거 회차 데이터
 * @param weight 가중치
 */
export async function recommendAIWithNextFreq(
  rounds: PremiumLottoRecord[],
  weight: WeightConfig,
  clusterUnit: number = 5
): Promise<AIRecommendResult> {
  // 1. 최근 회차 분석
  const latestRoundNo = rounds[rounds.length - 1].drwNo;
  const analysis: PremiumAnalysisResult = await analyzePremiumRound(
    latestRoundNo,
    false,
    20
  );

  const nextFreqMap = analysis.perNumberNextFreq;
  // 2. 번호별 원본 점수 계산
  const rawScoreList: NumberScoreDetail[] = [];
  const helper = new AiFeatureHelper(rounds);

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

  // 3. 최종 점수 정규화 (0~100)
  const normalizedMap = normalizeScores(
    Object.fromEntries(rawScoreList.map((s) => [s.num, s.final]))
  );

  // 4. 정규화된 scoreList 생성
  const scoreList = rawScoreList.map((s) => ({
    ...s,
    final: normalizedMap[s.num],
  }));

  // 5. 추천 번호 (정규화된 점수 기준 TOP 20)
  const top20 = [...scoreList].sort((a, b) => b.final - a.final).slice(0, 20);

  // 최종 추천 6개
  const picked = top20.slice(0, 6);

  return {
    combination: picked.map((p) => p.num),
    details: picked,
    scores: scoreList, // 🔥 전체 정규화된 점수
  };
}
