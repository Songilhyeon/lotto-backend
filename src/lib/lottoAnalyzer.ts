// lottoAnalyzer.ts
import {
  getPremiumRound,
  getPremiumRounds,
  redisGet,
  redisSet,
  PremiumLottoRecord,
} from "./premiumCache";

export interface PatternNextFreq {
  patternKey: string;
  freq: Record<number, number>;
}

export interface PremiumAnalysisResult {
  round: number;
  bonusIncluded: boolean;
  perNumberNextFreq: Record<number, Record<number, number>>;
  kMatchNextFreq: Record<string, Record<number, number>>;
  pattern10NextFreq: PatternNextFreq;
  pattern7NextFreq: PatternNextFreq;
  recentFreq: Record<number, number>;
  nextRound: {
    round: number;
    numbers: number[];
    bonus: number | null;
  } | null;
  generatedAt: string;
}

// ------------------------------
// 유틸
// ------------------------------
export function numbersToBitmask(numbers: number[]): bigint {
  let mask = 0n;
  for (const n of numbers) mask |= 1n << BigInt(n - 1);
  return mask;
}

export function intersectionCount(a: bigint, b: bigint): number {
  let x = a & b;
  let count = 0;
  while (x) {
    if (x & 1n) count++;
    x >>= 1n;
  }
  return count;
}

export function patternBuckets(numbers: number[], unitSize: number): number[] {
  const bucketCount = Math.ceil(45 / unitSize);
  const buckets = Array(bucketCount).fill(0);
  for (const n of numbers) buckets[Math.floor((n - 1) / unitSize)]++;
  return buckets;
}

export function patternKey(buckets: number[]): string {
  return buckets.join("-");
}

// ------------------------------
// Premium 분석 (프론트 옵션 포함)
// ------------------------------
export async function analyzePremiumRound(
  round: number,
  bonusIncluded = false,
  recentCount = 10 // ★ 기본값 10으로 설정
): Promise<PremiumAnalysisResult> {
  const cacheKey = `premium:analysis:${round}:bonus:${
    bonusIncluded ? 1 : 0
  }:recent:${recentCount}`;
  const cached = await redisGet<PremiumAnalysisResult>(cacheKey);
  if (cached) return cached;

  const baseRoundObj = getPremiumRound(round);
  if (!baseRoundObj) throw new Error(`Round ${round} not found`);

  // 보호: 원본 데이터 손상 방지
  const roundObj = {
    ...baseRoundObj,
    numbers: [...baseRoundObj.numbers],
  };
  if (bonusIncluded) {
    roundObj.numbers = [...roundObj.numbers, roundObj.bonus];
  }

  // 🔥 핵심: 분석 범위는 항상 "1~round"
  const latestRound = round;
  const roundsSorted = getPremiumRounds(1, latestRound);

  // ------------------------------
  // 유틸 freq 초기화
  // ------------------------------
  const initFreq = (): Record<number, number> => {
    const freq: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    return freq;
  };

  // ------------------------------
  // 1) 번호별 다음 회차 빈도
  // ------------------------------
  const numToRounds: Record<number, PremiumLottoRecord[]> = {};
  for (let n = 1; n <= 45; n++) numToRounds[n] = [];

  for (const r of roundsSorted) {
    const nums = bonusIncluded ? [...r.numbers, r.bonus] : r.numbers;
    nums.forEach((num) => numToRounds[num].push(r));
  }

  const perNumberNextFreq: Record<number, Record<number, number>> = {};

  for (const num of roundObj.numbers) {
    const freq = initFreq();
    for (const r of numToRounds[num]) {
      const nextRound = getPremiumRound(r.drwNo + 1);
      if (!nextRound) continue;

      const nextNums = bonusIncluded
        ? [...nextRound.numbers, nextRound.bonus]
        : nextRound.numbers;

      nextNums.forEach((n) => freq[n]++);
    }
    perNumberNextFreq[num] = freq;
  }

  // ------------------------------
  // 2) K-match 분석
  // ------------------------------
  const targetMask = numbersToBitmask(roundObj.numbers);

  const kMatchNextFreq: Record<string, Record<number, number>> = {
    "1": initFreq(),
    "2": initFreq(),
    "3": initFreq(),
    "4+": initFreq(),
  };

  for (const r of roundsSorted) {
    const mask = numbersToBitmask(r.numbers);
    const inter = intersectionCount(targetMask, mask);

    const nextRound = getPremiumRound(r.drwNo + 1);
    if (!nextRound) continue;

    const nextNums = bonusIncluded
      ? [...nextRound.numbers, nextRound.bonus]
      : nextRound.numbers;

    let key: string | null = null;
    if (inter >= 4) key = "4+";
    else if (inter === 3) key = "3";
    else if (inter === 2) key = "2";
    else if (inter === 1) key = "1";

    if (!key) continue;

    nextNums.forEach((n) => kMatchNextFreq[key][n]++);
  }

  // ------------------------------
  // 3) 패턴 기반 분석 (10단위 / 7단위)
  // ------------------------------
  function computePatternNext(unitSize: number): PatternNextFreq {
    const buckets = patternBuckets(roundObj.numbers, unitSize);
    const key = patternKey(buckets);
    const freq = initFreq();

    for (const r of roundsSorted) {
      const rBuckets = patternBuckets(r.numbers, unitSize);
      if (patternKey(rBuckets) !== key) continue;

      const nextRound = getPremiumRound(r.drwNo + 1);
      if (!nextRound) continue;

      const nextNums = bonusIncluded
        ? [...nextRound.numbers, nextRound.bonus]
        : nextRound.numbers;

      nextNums.forEach((n) => freq[n]++);
    }

    return { patternKey: key, freq };
  }

  const pattern10NextFreq = computePatternNext(10);
  const pattern7NextFreq = computePatternNext(7);

  // ------------------------------
  // 4) 최근 N회 빈도
  // ------------------------------
  const selectedIndex = roundsSorted.findIndex((r) => r.drwNo === round);
  if (selectedIndex === -1) throw new Error("선택한 회차 없음");

  const startIdx = Math.max(0, selectedIndex - recentCount) + 1;
  const recentRounds = roundsSorted.slice(startIdx, selectedIndex + 1);

  const recentFreq = initFreq();
  recentRounds.forEach((r) => {
    const nums = bonusIncluded ? [...r.numbers, r.bonus] : r.numbers;
    nums.forEach((n) => recentFreq[n]++);
  });

  // ------------------------------
  // 5) 다음 회차 정보
  // ------------------------------
  const nextRoundData = getPremiumRound(round + 1);
  const nextRound = nextRoundData
    ? {
        round: nextRoundData.drwNo,
        numbers: nextRoundData.numbers,
        bonus: bonusIncluded ? nextRoundData.bonus : null,
      }
    : null;

  // ------------------------------
  // 결과 반환
  // ------------------------------
  const result: PremiumAnalysisResult = {
    round,
    bonusIncluded,
    perNumberNextFreq,
    kMatchNextFreq,
    pattern10NextFreq,
    pattern7NextFreq,
    recentFreq,
    nextRound,
    generatedAt: new Date().toISOString(),
  };

  await redisSet(cacheKey, result, 6 * 60 * 60);
  return result;
}
