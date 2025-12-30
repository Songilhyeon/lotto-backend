// premiumAnalyzer.ts (Enhanced with additional statistics)
// -------------------------------
// 개선 사항:
// 1. 구간별(high/mid/low) 분석 추가
// 2. 합계 범위 패턴 분석
// 3. 연속/간격 번호 패턴
// 4. 소수(prime) 분석
// 5. 성능 최적화 (중복 계산 제거)
// 6. 메모리 효율성 개선
// -------------------------------

import { getPremiumRound, getPremiumRange, BASE } from "./premiumCache";

export interface PremiumAnalysisResult {
  round: number;
  bonusIncluded: boolean;

  // 기존 통계
  perNumberNextFreq: Record<number, Record<number, number>>;
  kMatchNextFreq: Record<"1" | "2" | "3" | "4+", Record<number, number>>;
  pattern15NextFreq: Record<number, number>; // 15개 단위 패턴
  pattern10NextFreq: Record<number, number>;
  pattern7NextFreq: Record<number, number>;
  pattern5NextFreq: Record<number, number>;
  recentFreq: Record<number, number>;
  oddEvenNextFreq: {
    odd: number;
    even: number;
    ratio: number;
  };
  lastAppearance: Record<number, number>;
  consecutiveAppearances: Record<number, number>;

  // 신규 통계
  sumRangeNextFreq: SumRangeFrequency; // 합계 범위별 다음 회차
  zoneNextFreq: ZoneFrequency; // 구간별(저/중/고) 다음 회차
  consecutivePatternNextFreq: Record<number, number>; // 연속 번호 패턴
  primeNextFreq: PrimeFrequency; // 소수 패턴
  gapPatternNextFreq: GapPatternFrequency; // 번호 간격 패턴

  nextRound: NextRoundObj | null;
  generatedAt: string;

  // 메타 정보
  analysisMetadata: {
    totalRoundsAnalyzed: number;
    patternMatchCounts: {
      pattern10: number;
      pattern7: number;
      pattern5: number;
      pattern15: number; // 추가
      sumRange: number;
      oddEven: number;
    };
  };
}

// 신규 타입 정의
type SumRangeKey = "low" | "mid" | "high"; // <120, 120-165, >165
interface SumRangeFrequency {
  low: Record<number, number>;
  mid: Record<number, number>;
  high: Record<number, number>;
}

type ZoneKey = "low" | "mid" | "high"; // 1-15, 16-30, 31-45
interface ZoneFrequency {
  low: Record<number, number>;
  mid: Record<number, number>;
  high: Record<number, number>;
}

interface PrimeFrequency {
  primeCount: Record<number, number>; // 소수 개수별 다음 회차
  isPrime: Record<number, number>; // 소수 번호의 출현 빈도
}

interface GapPatternFrequency {
  avgGap: Record<string, Record<number, number>>; // 평균 간격별
  maxGap: Record<string, Record<number, number>>; // 최대 간격별
}

type NextRoundObj = {
  round: number;
  numbers: number[];
  bonus?: number | null;
};

// ----------------------------------
// 유틸리티 함수들
// ----------------------------------

function isValidNumber(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  return BASE === 1 ? n >= 1 && n <= 45 : n >= 0 && n <= 44;
}

// Bitmask popcount (최적화)
function popcount(x: bigint): number {
  let c = 0;
  while (x) {
    x &= x - 1n;
    c++;
  }
  return c;
}

function inter(a: bigint, b: bigint): number {
  return popcount(a & b);
}

// 배열 → Record 변환 (메모이제이션 가능)
function arrToRecord(arr: number[]): Record<number, number> {
  const start = BASE;
  const end = BASE === 1 ? 45 : 44;
  const obj: Record<number, number> = {};
  for (let i = start; i <= end; i++) obj[i] = arr[i] ?? 0;
  return obj;
}

// ----------------------------------
// 소수 판별 (1-45 범위 미리 계산)
// ----------------------------------
const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);

function isPrime(n: number): boolean {
  return PRIMES.has(n);
}

function countPrimes(numbers: number[]): number {
  return numbers.filter((n) => isValidNumber(n) && isPrime(n)).length;
}

// ----------------------------------
// 합계 계산
// ----------------------------------
function sumNumbers(numbers: number[]): number {
  return numbers.filter(isValidNumber).reduce((sum, n) => sum + n, 0);
}

function getSumRange(sum: number): SumRangeKey {
  if (sum < 120) return "low";
  if (sum <= 165) return "mid";
  return "high";
}

// ----------------------------------
// 구간 분류 (저/중/고)
// ----------------------------------
function getZone(n: number): ZoneKey {
  if (n <= 15) return "low";
  if (n <= 30) return "mid";
  return "high";
}

function countZones(numbers: number[]): Record<ZoneKey, number> {
  const zones = { low: 0, mid: 0, high: 0 };
  for (const n of numbers) {
    if (!isValidNumber(n)) continue;
    zones[getZone(n)]++;
  }
  return zones;
}

// ----------------------------------
// 연속 번호 개수
// ----------------------------------
function countConsecutive(numbers: number[]): number {
  const sorted = [...numbers].filter(isValidNumber).sort((a, b) => a - b);
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) count++;
  }
  return count;
}

// ----------------------------------
// 번호 간격 분석
// ----------------------------------
function analyzeGaps(numbers: number[]): { avgGap: number; maxGap: number } {
  const sorted = [...numbers].filter(isValidNumber).sort((a, b) => a - b);
  if (sorted.length < 2) return { avgGap: 0, maxGap: 0 };

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }

  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  const maxGap = Math.max(...gaps);

  return { avgGap: Math.round(avgGap), maxGap };
}

// ----------------------------------
// 패턴 버킷 (기존 로직)
// ----------------------------------
function patternBuckets(numbers: number[], unitSize: number): number[] {
  const maxVal = BASE === 1 ? 45 : 44;
  const bucketCount = Math.ceil((maxVal + 1) / unitSize);
  const buckets = Array(bucketCount).fill(0);

  for (const n of numbers) {
    if (!isValidNumber(n)) continue;
    const idx = Math.floor((n - BASE) / unitSize);
    if (idx >= 0 && idx < bucketCount) buckets[idx]++;
  }
  return buckets;
}

function patternKey(buckets: number[]): string {
  return buckets.join("-");
}

// ----------------------------------
// 패턴 다음 회차 빈도 (개선: 매칭 카운트 반환)
// ----------------------------------
function computePatternNext(
  unitSize: number,
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): { freq: number[]; matchCount: number } {
  const freq = Array(46).fill(0);
  let matchCount = 0;

  const keyBuckets = patternBuckets(targetNumbers, unitSize);
  const key = patternKey(keyBuckets);

  for (const r of rounds) {
    const rBuckets = patternBuckets(r.numbers, unitSize);
    if (patternKey(rBuckets) !== key) continue;

    matchCount++;
    const nextRound = getPremiumRound(r.drwNo + 1);
    if (!nextRound) continue;

    const nextMask = bonusIncluded ? nextRound.bonusMask : nextRound.mask;

    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) !== 0n) freq[m]++;
    }
  }

  return { freq, matchCount };
}

// ----------------------------------
// 홀짝 카운트
// ----------------------------------
function countOddEven(numbers: number[]) {
  let odd = 0;
  let even = 0;

  for (const n of numbers) {
    if (!isValidNumber(n)) continue;
    if (n % 2 === 0) even++;
    else odd++;
  }

  return { odd, even };
}

// ----------------------------------
// 합계 범위 기반 다음 회차 빈도
// ----------------------------------
function computeSumRangeNext(
  rounds: ReturnType<typeof getPremiumRange>,
  targetSum: number,
  bonusIncluded: boolean
): { data: SumRangeFrequency; matchCount: number } {
  const result: SumRangeFrequency = {
    low: {},
    mid: {},
    high: {},
  };

  for (let i = 1; i <= 45; i++) {
    result.low[i] = 0;
    result.mid[i] = 0;
    result.high[i] = 0;
  }

  const targetRange = getSumRange(targetSum);
  let matchCount = 0;

  for (const r of rounds) {
    const rSum = sumNumbers(r.numbers);
    if (getSumRange(rSum) !== targetRange) continue;

    matchCount++;
    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;

    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) !== 0n) result[targetRange][m]++;
    }
  }

  return { data: result, matchCount };
}

// ----------------------------------
// 구간 분포 기반 다음 회차 빈도
// ----------------------------------
function computeZoneNext(
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): ZoneFrequency {
  const result: ZoneFrequency = {
    low: {},
    mid: {},
    high: {},
  };

  for (let i = 1; i <= 45; i++) {
    result.low[i] = 0;
    result.mid[i] = 0;
    result.high[i] = 0;
  }

  const targetZones = countZones(targetNumbers);

  for (const r of rounds) {
    const rZones = countZones(r.numbers);

    // 구간 분포가 동일한 경우만
    if (
      rZones.low === targetZones.low &&
      rZones.mid === targetZones.mid &&
      rZones.high === targetZones.high
    ) {
      const next = getPremiumRound(r.drwNo + 1);
      if (!next) continue;

      const nextMask = bonusIncluded ? next.bonusMask : next.mask;

      for (let m = 1; m <= 45; m++) {
        const shift = BigInt(m - BASE);
        if ((nextMask & (1n << shift)) !== 0n) {
          result[getZone(m)][m]++;
        }
      }
    }
  }

  return result;
}

// ----------------------------------
// 연속 번호 패턴 기반 다음 회차
// ----------------------------------
function computeConsecutivePatternNext(
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): number[] {
  const freq = Array(46).fill(0);
  const targetConsecutive = countConsecutive(targetNumbers);

  for (const r of rounds) {
    if (countConsecutive(r.numbers) !== targetConsecutive) continue;

    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;

    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) !== 0n) freq[m]++;
    }
  }

  return freq;
}

// ----------------------------------
// 소수 패턴 기반 다음 회차
// ----------------------------------
function computePrimeNext(
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): PrimeFrequency {
  const primeCount: Record<number, number> = {};
  const isPrimeFreq: Record<number, number> = {};

  for (let i = 0; i <= 6; i++) primeCount[i] = 0;
  for (let i = 1; i <= 45; i++) isPrimeFreq[i] = 0;

  const targetPrimeCount = countPrimes(targetNumbers);

  for (const r of rounds) {
    if (countPrimes(r.numbers) !== targetPrimeCount) continue;

    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;

    const nextMask = bonusIncluded ? next.bonusMask : next.mask;
    let nextPrimeCount = 0;

    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) !== 0n) {
        isPrimeFreq[m]++;
        if (isPrime(m)) nextPrimeCount++;
      }
    }

    primeCount[nextPrimeCount]++;
  }

  return { primeCount, isPrime: isPrimeFreq };
}

// ----------------------------------
// 간격 패턴 기반 다음 회차
// ----------------------------------
function computeGapPatternNext(
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): GapPatternFrequency {
  const avgGapMap: Record<string, Record<number, number>> = {};
  const maxGapMap: Record<string, Record<number, number>> = {};

  const targetGaps = analyzeGaps(targetNumbers);
  const targetAvgKey = targetGaps.avgGap.toString();
  const targetMaxKey = targetGaps.maxGap.toString();

  avgGapMap[targetAvgKey] = {};
  maxGapMap[targetMaxKey] = {};

  for (let i = 1; i <= 45; i++) {
    avgGapMap[targetAvgKey][i] = 0;
    maxGapMap[targetMaxKey][i] = 0;
  }

  for (const r of rounds) {
    const rGaps = analyzeGaps(r.numbers);

    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;

    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) === 0n) continue;

      if (rGaps.avgGap === targetGaps.avgGap) {
        avgGapMap[targetAvgKey][m]++;
      }

      if (rGaps.maxGap === targetGaps.maxGap) {
        maxGapMap[targetMaxKey][m]++;
      }
    }
  }

  return { avgGap: avgGapMap, maxGap: maxGapMap };
}

// ----------------------------------
// 메인 분석 함수 (최적화)
// ----------------------------------
export async function analyzePremiumRound(
  round: number,
  bonusIncluded: boolean,
  recentCount: number
): Promise<PremiumAnalysisResult> {
  if (!Number.isInteger(round) || round < 1)
    throw new Error("round는 1 이상의 정수여야 합니다.");
  if (!Number.isInteger(recentCount) || recentCount < 1)
    throw new Error("recentCount는 1 이상의 정수여야 합니다.");

  const target = getPremiumRound(round);
  if (!target) throw new Error(`해당 회차(${round}) 데이터 없음`);

  const targetMask = bonusIncluded ? target.bonusMask : target.mask;
  const rounds = getPremiumRange(1, round - 1);

  // ----------------------------------
  // 기존 통계 계산 (변경 없음)
  // ----------------------------------

  // lastAppearance
  const lastAppearanceMap: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) lastAppearanceMap[n] = 0;

  for (let searchRound = round; searchRound >= 1; searchRound--) {
    const r = getPremiumRound(searchRound);
    if (!r) continue;

    const mask = bonusIncluded ? r.bonusMask : r.mask;

    for (let n = 1; n <= 45; n++) {
      if (lastAppearanceMap[n] !== 0) continue;

      const shift = BigInt(n - BASE);
      if ((mask & (1n << shift)) !== 0n) {
        lastAppearanceMap[n] = searchRound;
      }
    }

    if (Object.values(lastAppearanceMap).every((v) => v !== 0)) break;
  }

  // consecutiveAppearances
  const consecutiveMap: Record<number, number> = {};

  for (let n = 1; n <= 45; n++) {
    let maxStreak = 0;
    let currentStreak = 0;

    for (let searchRound = round; searchRound >= 1; searchRound--) {
      const r = getPremiumRound(searchRound);
      if (!r) break;

      const mask = r.mask;
      const shift = BigInt(n - BASE);

      if ((mask & (1n << shift)) !== 0n) {
        currentStreak++;
        if (currentStreak >= 2) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    consecutiveMap[n] = maxStreak;
  }

  // perNumberNextFreq
  const perNumberNextFreq: Record<number, Record<number, number>> = {};
  const numbersToTrack = target.numbers.concat(
    bonusIncluded && target.bonus ? [target.bonus] : []
  );

  for (const n of numbersToTrack) {
    if (!isValidNumber(n)) continue;
    const freq: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    perNumberNextFreq[n] = freq;
  }

  // K-match
  const kMatchNext = {
    "1": Array(46).fill(0),
    "2": Array(46).fill(0),
    "3": Array(46).fill(0),
    "4+": Array(46).fill(0),
  };

  // 메인 루프 (한 번에 여러 통계 계산)
  for (const r of rounds) {
    const rMask = bonusIncluded ? r.bonusMask : r.mask;
    const kMatch = inter(targetMask, rMask);

    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;
    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    // perNumberNextFreq
    for (const tn of numbersToTrack) {
      if (!isValidNumber(tn)) continue;
      const shiftT = BigInt(tn - BASE);
      const inCurrent = (rMask & (1n << shiftT)) !== 0n;
      if (!inCurrent) continue;

      for (let m = 1; m <= 45; m++) {
        const shift = BigInt(m - BASE);
        if ((nextMask & (1n << shift)) !== 0n) perNumberNextFreq[tn][m]++;
      }
    }

    // K-match
    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) === 0n) continue;

      if (kMatch >= 4) kMatchNext["4+"][m]++;
      else if (kMatch === 3) kMatchNext["3"][m]++;
      else if (kMatch === 2) kMatchNext["2"][m]++;
      else if (kMatch === 1) kMatchNext["1"][m]++;
    }
  }

  // 패턴 분석
  const pattern10Result = computePatternNext(
    10,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern7Result = computePatternNext(
    7,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern5Result = computePatternNext(
    5,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern15Result = computePatternNext(
    15,
    rounds,
    target.numbers,
    bonusIncluded
  ); // 추가

  // 최근 N회 빈도
  const recentFreqArr = Array(46).fill(0);
  const recentStart = Math.max(1, round - recentCount + 1);
  const recentRounds = getPremiumRange(recentStart, round);

  for (const r of recentRounds) {
    const mask = bonusIncluded ? r.bonusMask : r.mask;
    for (let n = 1; n <= 45; n++) {
      const shift = BigInt(n - BASE);
      if ((mask & (1n << shift)) !== 0n) recentFreqArr[n]++;
    }
  }

  // 다음 회차
  const nextObj = getPremiumRound(round + 1);
  const nextRoundWithBonus = nextObj
    ? {
        round: nextObj.drwNo,
        numbers: nextObj.numbers,
        bonus: nextObj.bonus,
      }
    : null;

  // 홀짝 패턴
  const targetOddEven = countOddEven(target.numbers);
  let oddNext = 0;
  let evenNext = 0;
  let oddEvenMatchCount = 0;

  for (const r of rounds) {
    const rOddEven = countOddEven(r.numbers);

    if (
      rOddEven.odd === targetOddEven.odd &&
      rOddEven.even === targetOddEven.even
    ) {
      const next = getPremiumRound(r.drwNo + 1);
      if (!next) continue;

      const nextOE = countOddEven(next.numbers);
      oddNext += nextOE.odd;
      evenNext += nextOE.even;
      oddEvenMatchCount++;
    }
  }

  const oddEvenNextFreq = {
    odd: oddNext,
    even: evenNext,
    ratio: oddNext + evenNext > 0 ? oddNext / (oddNext + evenNext) : 0,
  };

  // ----------------------------------
  // 신규 통계 계산
  // ----------------------------------

  const targetSum = sumNumbers(target.numbers);
  const sumRangeResult = computeSumRangeNext(rounds, targetSum, bonusIncluded);
  const zoneNextFreq = computeZoneNext(rounds, target.numbers, bonusIncluded);
  const consecutivePatternNext = computeConsecutivePatternNext(
    rounds,
    target.numbers,
    bonusIncluded
  );
  const primeNextFreq = computePrimeNext(rounds, target.numbers, bonusIncluded);
  const gapPatternNextFreq = computeGapPatternNext(
    rounds,
    target.numbers,
    bonusIncluded
  );

  // ----------------------------------
  // 결과 반환
  // ----------------------------------
  return {
    round,
    bonusIncluded,

    // 기존 통계
    perNumberNextFreq,
    kMatchNextFreq: {
      "1": arrToRecord(kMatchNext["1"]),
      "2": arrToRecord(kMatchNext["2"]),
      "3": arrToRecord(kMatchNext["3"]),
      "4+": arrToRecord(kMatchNext["4+"]),
    },
    pattern10NextFreq: arrToRecord(pattern10Result.freq),
    pattern7NextFreq: arrToRecord(pattern7Result.freq),
    pattern5NextFreq: arrToRecord(pattern5Result.freq),
    pattern15NextFreq: arrToRecord(pattern15Result.freq), // 추가
    recentFreq: arrToRecord(recentFreqArr),
    oddEvenNextFreq,
    lastAppearance: lastAppearanceMap,
    consecutiveAppearances: consecutiveMap,

    // 신규 통계
    sumRangeNextFreq: sumRangeResult.data,
    zoneNextFreq,
    consecutivePatternNextFreq: arrToRecord(consecutivePatternNext),
    primeNextFreq,
    gapPatternNextFreq,

    nextRound: nextRoundWithBonus,
    generatedAt: new Date().toISOString(),

    // 메타 정보
    analysisMetadata: {
      totalRoundsAnalyzed: rounds.length,
      patternMatchCounts: {
        pattern15: pattern15Result.matchCount, // 추가
        pattern10: pattern10Result.matchCount,
        pattern7: pattern7Result.matchCount,
        pattern5: pattern5Result.matchCount,
        sumRange: sumRangeResult.matchCount,
        oddEven: oddEvenMatchCount,
      },
    },
  };
}
