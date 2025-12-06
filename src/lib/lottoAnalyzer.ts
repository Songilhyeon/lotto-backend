// lottoAnalyzer.ts (Bitmask 최적화 + 정확한 패턴 기반 다음 회차)
import {
  getPremiumRound,
  getPremiumLatestRound,
  getPremiumRange,
} from "./premiumCache";

export interface PremiumAnalysisResult {
  round: number;
  bonusIncluded: boolean;
  perNumberNextFreq: Record<number, Record<number, number>>; // 번호별 다음 회차 빈도
  kMatchNextFreq: Record<"1" | "2" | "3" | "4+", Record<number, number>>;
  pattern10NextFreq: Record<number, number>;
  pattern7NextFreq: Record<number, number>;
  recentFreq: Record<number, number>;
  nextRound: NextRoundObj | null;
  generatedAt: string;
}

type NextRoundObj = {
  round: number;
  numbers: number[];
  bonus?: number | null;
};

// ----------------------------------
// Bitmask popcount
// ----------------------------------
function popcount(x: bigint): number {
  let c = 0n;
  while (x) {
    x &= x - 1n;
    c++;
  }
  return Number(c);
}

function inter(a: bigint, b: bigint): number {
  return popcount(a & b);
}

// ----------------------------------
// 배열 → Record 변환
// ----------------------------------
function arrToRecord(arr: number[]): Record<number, number> {
  const obj: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) obj[i] = arr[i] ?? 0;
  return obj;
}

// ----------------------------------
// 숫자 배열을 단위(unitSize)별로 버킷으로 나누기
// ----------------------------------
function patternBuckets(numbers: number[], unitSize: number): number[] {
  const buckets = Array(Math.ceil(45 / unitSize)).fill(0);
  for (const n of numbers) {
    const idx = Math.floor((n - 1) / unitSize);
    buckets[idx]++;
  }
  return buckets;
}

// ----------------------------------
// 버킷 배열을 문자열 키로 변환
// ----------------------------------
function patternKey(buckets: number[]): string {
  return buckets.join("-");
}

// ----------------------------------
// 패턴 다음 회차 빈도 계산
// ----------------------------------
function computePatternNext(
  unitSize: number,
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): number[] {
  const freq = Array(46).fill(0);
  const keyBuckets = patternBuckets(targetNumbers, unitSize);
  const key = patternKey(keyBuckets);

  for (const r of rounds) {
    const rBuckets = patternBuckets(r.numbers, unitSize);
    if (patternKey(rBuckets) !== key) continue;

    const nextRound = getPremiumRound(r.drwNo + 1);
    if (!nextRound) continue;

    const nextMask = bonusIncluded ? nextRound.bonusMask : nextRound.mask;
    for (let m = 1; m <= 45; m++) {
      if ((nextMask & (1n << BigInt(m))) !== 0n) freq[m]++;
    }
  }

  return freq;
}

// ----------------------------------
// 분석 메인
// ----------------------------------
export async function analyzePremiumRound(
  round: number,
  bonusIncluded: boolean,
  recentCount: number
): Promise<PremiumAnalysisResult> {
  const target = getPremiumRound(round);
  if (!target) throw new Error("Round not found");

  const targetMask = bonusIncluded ? target.bonusMask : target.mask;
  const latest = getPremiumLatestRound();
  const rounds = getPremiumRange(1, round - 1);

  // -----------------------------------
  // 초기화
  // -----------------------------------
  const perNumberNextFreq: Record<number, Record<number, number>> = {};
  const kMatchNext: {
    "1": number[];
    "2": number[];
    "3": number[];
    "4+": number[];
  } = {
    "1": Array(46).fill(0),
    "2": Array(46).fill(0),
    "3": Array(46).fill(0),
    "4+": Array(46).fill(0),
  };

  // 각 선택된 번호별 빈도 초기화
  const numbersToTrack = target.numbers.concat(
    bonusIncluded && target.bonus ? [target.bonus] : []
  );
  for (const n of numbersToTrack) {
    const freq: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    perNumberNextFreq[n] = freq;
  }

  // -----------------------------------
  // 메인 루프
  // -----------------------------------
  for (const r of rounds) {
    const k = inter(targetMask, r.mask);
    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;
    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    // 선택된 번호 + 보너스(옵션)별 다음 회차 빈도 계산
    for (const n of numbersToTrack) {
      const inCurrent =
        (r.mask & (1n << BigInt(n))) !== 0n ||
        (bonusIncluded &&
          target.bonus === n &&
          (r.bonusMask & (1n << BigInt(n))) !== 0n);

      if (!inCurrent) continue;

      for (let m = 1; m <= 45; m++) {
        if ((nextMask & (1n << BigInt(m))) !== 0n) {
          perNumberNextFreq[n][m]++;
        }
      }
    }

    // K-match
    for (let m = 1; m <= 45; m++) {
      if ((nextMask & (1n << BigInt(m))) !== 0n) {
        if (k >= 4) kMatchNext["4+"][m]++;
        else if (k === 3) kMatchNext["3"][m]++;
        else if (k === 2) kMatchNext["2"][m]++;
        else if (k === 1) kMatchNext["1"][m]++;
      }
    }
  }

  // -----------------------------------
  // 패턴 다음 회차 빈도
  // -----------------------------------
  const pattern10Next = computePatternNext(
    10,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern7Next = computePatternNext(
    7,
    rounds,
    target.numbers,
    bonusIncluded
  );

  // -----------------------------------
  // 최근 N회 빈도
  // -----------------------------------
  const recentFreqArr = Array(46).fill(0);
  const recentStart = Math.max(1, latest - recentCount + 1);
  const recentRounds = getPremiumRange(recentStart, latest);

  for (const r of recentRounds) {
    const m = bonusIncluded ? r.bonusMask : r.mask;
    for (let n = 1; n <= 45; n++) {
      if ((m & (1n << BigInt(n))) !== 0n) recentFreqArr[n]++;
    }
  }

  // -----------------------------------
  // 다음 회차
  // -----------------------------------

  const nextObj = getPremiumRound(round + 1);
  const nextRoundWithBonus: NextRoundObj | null = nextObj
    ? {
        round: nextObj.drwNo,
        numbers: nextObj.numbers,
        bonus: nextObj.bonus, // 항상 포함
      }
    : null;

  return {
    round,
    bonusIncluded,
    perNumberNextFreq,
    kMatchNextFreq: {
      "1": arrToRecord(kMatchNext["1"]),
      "2": arrToRecord(kMatchNext["2"]),
      "3": arrToRecord(kMatchNext["3"]),
      "4+": arrToRecord(kMatchNext["4+"]),
    },
    pattern10NextFreq: arrToRecord(pattern10Next),
    pattern7NextFreq: arrToRecord(pattern7Next),
    recentFreq: arrToRecord(recentFreqArr),
    nextRound: nextRoundWithBonus, // NextRoundObj 형태로 전달
    generatedAt: new Date().toISOString(),
  };
}
