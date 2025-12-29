// ===================================================
// Round Number Distribution Pattern Analysis
// 회차별 번호 분포 패턴 분석
// ===================================================

type LottoRound = {
  drwNo: number;
  numbers: number[]; // 정렬된 6개 번호
};

type IntervalBucket = "S" | "M" | "L" | "XL";

/**
 * 회차별 번호 간 간격 패턴
 *
 * 예: [7, 13, 21, 28, 35, 42]
 * → gaps: [6, 8, 7, 7, 7] (5개)
 * → buckets: ["M", "M", "M", "M", "M"]
 */
type RoundDistPattern = {
  drwNo: number;
  numbers: number[];

  // 연속 번호 간 차이 (5개)
  gaps: number[];

  // 버킷화된 간격
  buckets: IntervalBucket[];

  // 버킷 분포
  bucketDist: {
    S: number; // ≤5
    M: number; // 6~10
    L: number; // 11~20
    XL: number; // 21+
  };

  // 간격 통계
  gapStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };

  // 패턴 문자열 표현
  patternStr: string; // "M-M-M-M-M"
};

/**
 * 패턴 매칭 결과
 */
export type PatternMatchResult = {
  sourceRound: number;
  sourcePattern: RoundDistPattern;

  matches: {
    matchedRound: number;
    similarity: number;
    nextRound: number;
    nextNumbers: number[];
  }[];
};

/**
 * 간격 → 버킷 변환
 */
export function gapToBucket(gap: number): IntervalBucket {
  if (gap <= 5) return "S";
  if (gap <= 10) return "M";
  if (gap <= 20) return "L";
  return "XL";
}

/**
 * 회차의 번호 분포 패턴 생성
 *
 * @param round 분석할 회차
 * @returns 번호 간 간격 패턴
 */
export function buildDistPattern(round: LottoRound): RoundDistPattern {
  // 정렬 확인
  const sorted = [...round.numbers].sort((a, b) => a - b);

  // 연속 번호 간 차이 계산 (5개)
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }

  // 버킷화
  const buckets = gaps.map((g) => gapToBucket(g));

  // 버킷 분포
  const bucketDist = {
    S: buckets.filter((b) => b === "S").length,
    M: buckets.filter((b) => b === "M").length,
    L: buckets.filter((b) => b === "L").length,
    XL: buckets.filter((b) => b === "XL").length,
  };

  // 통계
  const gapStats = {
    min: Math.min(...gaps),
    max: Math.max(...gaps),
    avg: gaps.reduce((a, b) => a + b, 0) / gaps.length,
    median: [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)],
  };

  return {
    drwNo: round.drwNo,
    numbers: sorted,
    gaps,
    buckets,
    bucketDist,
    gapStats,
    patternStr: buckets.join("-"),
  };
}

/**
 * 패턴 유사도 계산
 *
 * 여러 방식 지원:
 * - bucket: 버킷 분포 기반 (빠름)
 * - exact: 정확한 간격 비교 (느림, 정밀)
 * - hybrid: 혼합
 */
export function calcSimilarity(
  pattern1: RoundDistPattern,
  pattern2: RoundDistPattern,
  method: "bucket" | "exact" | "hybrid" = "hybrid"
): number {
  if (method === "bucket") {
    // 버킷 분포 차이
    const d1 = pattern1.bucketDist;
    const d2 = pattern2.bucketDist;

    const diff =
      Math.abs(d1.S - d2.S) +
      Math.abs(d1.M - d2.M) +
      Math.abs(d1.L - d2.L) +
      Math.abs(d1.XL - d2.XL);

    // 최대 차이는 10 (5개가 모두 다른 버킷)
    return 1 - diff / 10;
  }

  if (method === "exact") {
    // 각 간격의 절대 차이
    let totalDiff = 0;
    for (let i = 0; i < 5; i++) {
      totalDiff += Math.abs(pattern1.gaps[i] - pattern2.gaps[i]);
    }

    // 정규화: 최대 차이는 200 정도로 가정 (각 간격이 40씩 차이)
    return Math.max(0, 1 - totalDiff / 100);
  }

  // hybrid: 버킷 70% + exact 30%
  const bucketScore = calcSimilarity(pattern1, pattern2, "bucket");
  const exactScore = calcSimilarity(pattern1, pattern2, "exact");

  return bucketScore * 0.7 + exactScore * 0.3;
}

/**
 * 유사 패턴 검색 및 다음 회차 분석
 *
 * @param rounds 전체 회차 데이터
 * @param targetRound 분석할 회차 번호
 * @param minSimilarity 최소 유사도 (0~1)
 * @param topN 상위 N개만 반환
 */
export function findSimilarDistPatterns(
  rounds: LottoRound[],
  targetRound: number,
  minSimilarity = 0.7,
  topN = 10,
  method: "bucket" | "exact" | "hybrid" = "hybrid"
): PatternMatchResult | null {
  // 대상 회차 찾기
  const target = rounds.find((r) => r.drwNo === targetRound);
  if (!target) return null;

  const sourcePattern = buildDistPattern(target);
  const matches: PatternMatchResult["matches"] = [];

  // 모든 과거 회차 비교 (대상 회차 이전만)
  for (const round of rounds) {
    // 자기 자신과 다음 회차가 없는 경우 제외
    if (round.drwNo >= targetRound) break;

    const pattern = buildDistPattern(round);
    const similarity = calcSimilarity(sourcePattern, pattern, method);

    if (similarity >= minSimilarity) {
      // 다음 회차 찾기
      const nextRound = rounds.find((r) => r.drwNo === round.drwNo + 1);
      if (!nextRound) continue;

      matches.push({
        matchedRound: round.drwNo,
        similarity,
        nextRound: nextRound.drwNo,
        nextNumbers: nextRound.numbers,
      });
    }
  }

  // 유사도 높은 순 정렬
  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    sourceRound: targetRound,
    sourcePattern,
    matches: matches.slice(0, topN),
  };
}

/**
 * 다음 회차 번호 예측 (앙상블)
 *
 * 유사 패턴의 다음 회차 번호들을 유사도 가중치로 집계
 */
export function predictNextNumbers(
  result: PatternMatchResult
): Map<number, number> {
  const score = new Map<number, number>();

  for (const match of result.matches) {
    const weight = match.similarity;

    for (const num of match.nextNumbers) {
      score.set(num, (score.get(num) ?? 0) + weight);
    }
  }

  // 정규화 (0~1)
  let max = 0;
  for (const v of score.values()) {
    if (v > max) max = v;
  }

  if (max > 0) {
    for (const [n, v] of score.entries()) {
      score.set(n, v / max);
    }
  }

  return score;
}

/**
 * 다음 회차 간격 패턴 예측
 *
 * 유사 패턴의 다음 회차 간격 패턴들을 집계
 */
export function predictNextPattern(
  result: PatternMatchResult
): Map<string, number> {
  const patternFreq = new Map<string, number>();
  let totalWeight = 0;

  for (const match of result.matches) {
    // 다음 회차의 패턴 계산
    const nextRound = {
      drwNo: match.nextRound,
      numbers: match.nextNumbers,
    };

    const nextPattern = buildDistPattern(nextRound);
    const weight = match.similarity;

    patternFreq.set(
      nextPattern.patternStr,
      (patternFreq.get(nextPattern.patternStr) ?? 0) + weight
    );

    totalWeight += weight;
  }

  // 정규화
  if (totalWeight > 0) {
    for (const [pattern, weight] of patternFreq.entries()) {
      patternFreq.set(pattern, weight / totalWeight);
    }
  }

  return patternFreq;
}
