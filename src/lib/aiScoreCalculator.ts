// lib/analysis/aiScoreCalculator.ts
import { PremiumAnalysisResult } from "./premiumAnalyzer";

export const AI_WEIGHTS = {
  perNumber: 0.45,
  kMatch: 0.3,
  pattern: 0.15,
  recent: 0.1,
};

/**
 * 안전한 패턴 가중치 선택
 */
// function getPatternWeights(clusterUnit: number) {
//   if (clusterUnit >= 9) return { w10: 0.6, w7: 0.3, w5: 0.1 };
//   if (clusterUnit >= 7) return { w10: 0.3, w7: 0.5, w5: 0.2 };
//   return { w10: 0.2, w7: 0.3, w5: 0.5 };
// }
function getPatternWeights(clusterUnit: number) {
  if (clusterUnit >= 9) return { w10: 1.0, w7: 0.1, w5: 0.1 };
  if (clusterUnit >= 7) return { w10: 0.1, w7: 1.0, w5: 0.1 };
  return { w10: 0.1, w7: 0.1, w5: 1.0 };
}

/**
 * computeAiScore: analysis 객체가 불완전해도 안전하게 동작하도록 방어적으로 작성됨.
 *
 * - options.clusterUnit: 5/7/10 등 (기본 5)
 * - 반환: index 0 무시, 1..45 사용
 */
export function computeAiScore(
  analysis: Partial<PremiumAnalysisResult>,
  clusterUnit?: number
): number[] {
  clusterUnit = clusterUnit ?? 5;
  // 인덱스 0은 unused, 1..45 사용
  const score = Array(46).fill(0);

  // AI_WEIGHTS에서 필요한 값 가져오기 (기본값 방어)
  const perNumberW = (AI_WEIGHTS && AI_WEIGHTS.perNumber) ?? 1;
  const kMatchW = (AI_WEIGHTS && AI_WEIGHTS.kMatch) ?? 1;
  const patternW = (AI_WEIGHTS && AI_WEIGHTS.pattern) ?? 1;
  const recentW = (AI_WEIGHTS && AI_WEIGHTS.recent) ?? 1;
  const clusterW = (AI_WEIGHTS && (AI_WEIGHTS as any).cluster) ?? 1; // optional

  const { w10, w7, w5 } = getPatternWeights(clusterUnit);

  // 안전한 핸들링을 위해 analysis 내부 필드 가져오기 (기본값 제공)
  const per = analysis.perNumberNextFreq ?? {};
  const km = analysis.kMatchNextFreq ?? {
    "1": Array(46).fill(0),
    "2": Array(46).fill(0),
    "3": Array(46).fill(0),
    "4+": Array(46).fill(0),
  };
  const p10 = analysis.pattern10NextFreq ?? {};
  const p7 = analysis.pattern7NextFreq ?? {};
  const p5 = analysis.pattern5NextFreq ?? {};
  const recent = analysis.recentFreq ?? {};
  const rounds = (analysis as any).rounds ?? []; // 일부 코드에서 rounds 필요하면 analyzer에서 추가

  // selectedNums: perNumberNextFreq에 key가 없으면 빈 배열 처리
  const selectedNums = Object.keys(per).length
    ? Object.keys(per).map(Number)
    : [];

  // 1) perNumberNextFreq 기반 가중 평균 (안전성: selectedNums 길이 체크)
  const perAvg = Array(46).fill(0);
  if (selectedNums.length > 0) {
    for (let num = 1; num <= 45; num++) {
      let sum = 0;
      for (const sel of selectedNums) {
        sum += (per[sel] && per[sel][num]) ?? 0;
      }
      perAvg[num] = sum / selectedNums.length;
      score[num] += perAvg[num] * perNumberW;
    }
  } else {
    // per 데이터가 없다면 0 처리 (혹은 균일 기본값을 넣고 싶다면 설정)
    for (let num = 1; num <= 45; num++) {
      score[num] += 0;
    }
  }

  // 2) kMatchNextFreq (안전성: 각 km[...]이 비어있을 수 있음)
  for (let num = 1; num <= 45; num++) {
    const v1 = (km["1"] && (km["1"][num] ?? 0)) ?? 0;
    const v2 = (km["2"] && (km["2"][num] ?? 0)) ?? 0;
    const v3 = (km["3"] && (km["3"][num] ?? 0)) ?? 0;
    const v4 = (km["4+"] && (km["4+"][num] ?? 0)) ?? 0;

    const val = v1 * 0.7 + v2 * 0.2 + v3 * 0.1 + v4 * 0.05;
    score[num] += val * kMatchW;
  }

  // 3) 패턴 혼합 (p10/p7/p5 중 존재하지 않는 필드는 0 처리)
  for (let num = 1; num <= 45; num++) {
    const a = p10[num] ?? 0;
    const b = p7[num] ?? 0;
    const c = p5[num] ?? 0;

    const mixedPattern = a * w10 + b * w7 + c * w5;
    score[num] += mixedPattern * patternW;
  }

  // 4) 최근 빈도
  for (let num = 1; num <= 45; num++) {
    score[num] += (recent[num] ?? 0) * recentW;
  }

  // 5) (선택적) 강화된 Cluster 점수: 만약 rounds 정보가 analysis에 포함되어 있으면 적용
  //    - 안전하게 동작하게 rounds가 없으면 건너뜀
  if (Array.isArray(rounds) && rounds.length > 0) {
    const recent20 = rounds.slice(-20);
    const recent3 = rounds.slice(-3);
    const prev = rounds.length >= 2 ? rounds[rounds.length - 2] : null;

    for (let num = 1; num <= 45; num++) {
      const clusterIndex = Math.floor((num - 1) / clusterUnit);

      const count20 = recent20.filter((r: any) =>
        Array.isArray(r.numbers)
          ? r.numbers.some(
              (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
            )
          : false
      ).length;

      const count3 = recent3.filter((r: any) =>
        Array.isArray(r.numbers)
          ? r.numbers.some(
              (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
            )
          : false
      ).length;

      const appearedLast =
        prev && Array.isArray(prev.numbers)
          ? prev.numbers.some(
              (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
            )
            ? 1
            : 0
          : 0;

      const clusterScore = count20 * 10 + count3 * 5 + appearedLast * 10;
      score[num] += clusterScore * clusterW;
    }
  }

  return score;
}
