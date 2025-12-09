// aiRecommender.ts
import { analyzePremiumRound } from "./premiumAnalyzer";
import { computeAiScore } from "./aiScoreCalculator";
import { normalizeScores } from "../utils/normalizeScore";

interface AiRecommendOptions {
  round: number;
  clusterUnit?: number; // 기본값 5
}

export async function getAiRecommendation({
  round,
  clusterUnit = 5,
}: AiRecommendOptions) {
  const analysis = await analyzePremiumRound(round, false, 20);

  // 1) 원본 점수 생성
  const rawScore = computeAiScore(analysis, clusterUnit);

  // rawScore = Record<number, number>

  // 2) 정규화된 점수로 변환
  const normalized = normalizeScores(rawScore);

  // 3) scores 배열 생성 (프론트에서 사용)
  const scores = Array.from({ length: 45 }, (_, i) => ({
    num: i + 1,
    final: normalized[i + 1] ?? 0,
  }));

  // 4) 추천 번호 (정규화된 점수 기준)
  const recommended = scores
    .slice()
    .sort((a, b) => b.final - a.final)
    .slice(0, 6)
    .map((s) => s.num);

  return {
    round,
    recommended,
    scores, // 🔥 이제 정규화된 점수 목록
    generatedAt: new Date().toISOString(),
  };
}
