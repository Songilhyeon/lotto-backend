import { analyzePremiumRound } from "./premiumAnalyzer";
import { computeAiScore } from "./aiScoreCalculator";
import { normalizeScores } from "../utils/normalizeScores";
import { sortedLottoCache } from "../lib/lottoCache";
import { OptimizedLottoNumber } from "../types/lotto";

interface AiRecommendOptions {
  round: number;
  clusterUnit?: number; // 기본값 5
}

const getNumbers = (item: OptimizedLottoNumber) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
];

export async function getAiRecommendation({
  round,
  clusterUnit = 5,
}: AiRecommendOptions) {
  const analysis = await analyzePremiumRound(round, false, 20);

  // 1️⃣ 원본 점수 (Raw)
  const rawScore = computeAiScore(analysis, clusterUnit);
  // rawScore: Record<number, number>

  // 2️⃣ 정규화 점수 (0~100)
  const normalized = normalizeScores(rawScore);

  // 3️⃣ scores 배열 (표준 인터페이스)
  const scores = Array.from({ length: 45 }, (_, i) => {
    const num = i + 1;
    return {
      num,
      finalRaw: rawScore[num] ?? 0, // ✅ raw 유지
      final: normalized[num] ?? 0, // ✅ UI용
    };
  });

  // 4️⃣ 추천 번호 (정규화 점수 기준)
  const recommended = [...scores]
    .sort((a, b) => b.final - a.final)
    .slice(0, 6)
    .map((s) => s.num);

  // 5️⃣ 다음 회차 정보
  const checkNextRound = sortedLottoCache.find(
    (rec) => rec.drwNo === round + 1
  );

  const nextRound = checkNextRound
    ? {
        round: checkNextRound.drwNo,
        numbers: getNumbers(checkNextRound),
        bonus: Number(checkNextRound.bnusNo),
      }
    : null;

  return {
    round,
    nextRound,
    recommended,
    scores, // ✅ raw + normalized 둘 다 포함
    generatedAt: new Date().toISOString(),
  };
}
