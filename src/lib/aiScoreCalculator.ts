import { PremiumAnalysisResult } from "./premiumAnalyzer";

export const AI_WEIGHTS = {
  perNumber: 1,
  kMatch: 2,
  pattern: 2,
  recent: 1,
  oddEven: 1,
  clusterW: 3,
};

/**
 * 안전한 패턴 가중치 선택
 */
function getPatternWeights(clusterUnit: number) {
  if (clusterUnit >= 9) return { w10: 0.6, w7: 0.3, w5: 0.1 };
  if (clusterUnit >= 7) return { w10: 0.3, w7: 0.5, w5: 0.2 };
  return { w10: 0.2, w7: 0.3, w5: 0.5 };
}

function oddEvenScore(
  num: number,
  oddEven?: { odd: number; even: number; ratio: number }
) {
  if (!oddEven) return 0.5;
  const isOdd = num % 2 === 1;
  // ratio가 홀수 선호도라면
  return isOdd ? oddEven.ratio : 1 - oddEven.ratio;
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
  const score = Array(46).fill(0);

  const perNumberW = AI_WEIGHTS.perNumber;
  const kMatchW = AI_WEIGHTS.kMatch;
  const patternW = AI_WEIGHTS.pattern;
  const recentW = AI_WEIGHTS.recent;
  const oddEvenW = AI_WEIGHTS.oddEven;
  const clusterW = AI_WEIGHTS.clusterW;

  const { w10, w7, w5 } = getPatternWeights(clusterUnit);

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
  const oddEven = analysis.oddEvenNextFreq;
  const rounds = (analysis as any).rounds ?? [];

  const selectedNums = Object.keys(per).length
    ? Object.keys(per).map(Number)
    : [];

  // 1️⃣ perNumberNextFreq
  if (selectedNums.length > 0) {
    for (let num = 1; num <= 45; num++) {
      let sum = 0;
      for (const sel of selectedNums) {
        sum += per[sel]?.[num] ?? 0;
      }
      score[num] += (sum / selectedNums.length) * perNumberW;
    }
  }

  // 2️⃣ kMatch
  for (let num = 1; num <= 45; num++) {
    const val =
      (km["1"]?.[num] ?? 0) * 0.7 +
      (km["2"]?.[num] ?? 0) * 0.2 +
      (km["3"]?.[num] ?? 0) * 0.1 +
      (km["4+"]?.[num] ?? 0) * 0.05;
    score[num] += val * kMatchW;
  }

  // 3️⃣ pattern
  for (let num = 1; num <= 45; num++) {
    const mixed =
      (p10[num] ?? 0) * w10 + (p7[num] ?? 0) * w7 + (p5[num] ?? 0) * w5;
    score[num] += mixed * patternW;
  }

  // 4️⃣ recent
  for (let num = 1; num <= 45; num++) {
    score[num] += (recent[num] ?? 0) * recentW;
  }

  // 5️⃣ odd/even
  if (oddEvenW > 0) {
    for (let num = 1; num <= 45; num++) {
      score[num] += oddEvenScore(num, oddEven) * oddEvenW;
    }
  }

  // 6️⃣ cluster 강화 (정규화 적용)
  if (Array.isArray(rounds) && rounds.length > 0 && clusterW > 0) {
    const recent20 = rounds.slice(-20);
    const recent3 = rounds.slice(-3);
    const prev = rounds.length >= 2 ? rounds[rounds.length - 2] : null;

    for (let num = 1; num <= 45; num++) {
      const clusterIndex = Math.floor((num - 1) / clusterUnit);

      const count20 = recent20.filter((r: any) =>
        r.numbers?.some(
          (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
        )
      ).length;

      const count3 = recent3.filter((r: any) =>
        r.numbers?.some(
          (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
        )
      ).length;

      const appearedLast = prev?.numbers?.some(
        (x: number) => Math.floor((x - 1) / clusterUnit) === clusterIndex
      )
        ? 1
        : 0;

      // 클러스터 점수 계산 및 정규화 (최대값 250 기준)
      const clusterScore = count20 * 10 + count3 * 5 + appearedLast * 10;
      const normalizedCluster = clusterScore / 250;

      score[num] += normalizedCluster * clusterW;
    }
  }

  return score;
}
