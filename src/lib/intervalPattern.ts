// ===================================================
// Interval Pattern Based Trend Analysis (수정본)
// ===================================================

type LottoRound = {
  drwNo: number;
  numbers: number[];
};

type IntervalBucket = "S" | "M" | "L" | "XL";

type PatternNextFreqResult = {
  freq: Map<number, number>;
  sampleCount: number;
};

export function buildAppearMap(rounds: LottoRound[]): Map<number, number[]> {
  const map = new Map<number, number[]>();

  for (let n = 1; n <= 45; n++) {
    map.set(n, []);
  }

  for (const r of rounds) {
    for (const n of r.numbers) {
      map.get(n)!.push(r.drwNo);
    }
  }

  return map;
}

export function intervalToBucket(d: number): IntervalBucket {
  if (d <= 5) return "S";
  if (d <= 10) return "M";
  if (d <= 20) return "L";
  return "XL";
}

/**
 * 수정: 패턴 완성 회차를 명확히 구분
 * - patternEndRound: 패턴이 완성된 회차 (i-1번째 출현)
 * - nextRound: 실제 관측 대상 회차 (i번째 출현)
 */
export function buildPatternRoundIndex(
  appearMap: Map<number, number[]>,
  patternLen = 3
): Map<string, number[]> {
  const index = new Map<string, number[]>();

  for (const rounds of appearMap.values()) {
    if (rounds.length <= patternLen) continue;

    // i는 "다음 회차"의 인덱스 (패턴 완성 후 관측 대상)
    for (let i = patternLen; i < rounds.length; i++) {
      const buckets: string[] = [];

      // 패턴: rounds[i-patternLen] → ... → rounds[i-1]의 간격들
      for (let k = i - patternLen + 1; k <= i; k++) {
        const d = rounds[k] - rounds[k - 1];
        buckets.push(intervalToBucket(d));
      }

      const pattern = buckets.join("-");
      const patternEndRound = rounds[i - 1]; // 패턴 완성 시점

      if (!index.has(pattern)) index.set(pattern, []);
      index.get(pattern)!.push(patternEndRound);
    }
  }

  return index;
}

/**
 * 특정 번호의 최근 interval 패턴
 *
 * 주의: 최소 (patternLen + 1)번 출현해야 패턴 생성 가능
 * 예: patternLen=3이면 최소 4번 출현 필요
 */
export function getLatestIntervalPattern(
  appearMap: Map<number, number[]>,
  num: number,
  patternLen = 3
): string | null {
  const rounds = appearMap.get(num);

  // 패턴 생성에 필요한 최소 출현 횟수 체크
  if (!rounds || rounds.length < patternLen + 1) return null;

  const buckets: string[] = [];

  // 최근 patternLen개의 간격
  for (let k = rounds.length - patternLen; k < rounds.length; k++) {
    const d = rounds[k] - rounds[k - 1];
    buckets.push(intervalToBucket(d));
  }

  return buckets.join("-");
}

/**
 * 특정 번호의 해당 패턴 출현 횟수 (범위 내)
 */
export function countPatternOccurrences(
  appearMap: Map<number, number[]>,
  num: number,
  pattern: string,
  startRound: number,
  endRound: number,
  patternLen = 3
): number {
  const rounds = appearMap.get(num);
  if (!rounds || rounds.length <= patternLen) return 0;

  let count = 0;

  for (let i = patternLen; i < rounds.length; i++) {
    const buckets: string[] = [];

    for (let k = i - patternLen + 1; k <= i; k++) {
      const d = rounds[k] - rounds[k - 1];
      buckets.push(intervalToBucket(d));
    }

    const currentPattern = buckets.join("-");
    const patternEndRound = rounds[i - 1];

    if (
      currentPattern === pattern &&
      patternEndRound >= startRound &&
      patternEndRound <= endRound
    ) {
      count++;
    }
  }

  return count;
}

/**
 * 단일 패턴 → 다음 회차 번호 분포
 */
export function calcNextFreqByPatternWithSample(
  rounds: LottoRound[],
  patternIndex: Map<string, number[]>,
  targetPattern: string,
  minSample = 3
): PatternNextFreqResult {
  const freq = new Map<number, number>();
  const endRounds = patternIndex.get(targetPattern);

  if (!endRounds || endRounds.length < minSample) {
    return { freq, sampleCount: 0 };
  }

  const roundMap = new Map<number, LottoRound>();
  for (const r of rounds) roundMap.set(r.drwNo, r);

  let total = 0;

  for (const patternEndRound of endRounds) {
    // 패턴 완성 후 바로 다음 회차
    const next = roundMap.get(patternEndRound + 1);
    if (!next) continue;

    for (const n of next.numbers) {
      freq.set(n, (freq.get(n) ?? 0) + 1);
      total++;
    }
  }

  if (total > 0) {
    for (const [n, c] of freq.entries()) {
      freq.set(n, c / total);
    }
  }

  return {
    freq,
    sampleCount: endRounds.length,
  };
}

/**
 * Ensemble: 여러 번호의 패턴 결과 합산
 */
export function ensembleIntervalPatternNextFreq(
  rounds: LottoRound[],
  nums: number[],
  patternLen = 3,
  minSample = 3
): Map<number, number> {
  const score = new Map<number, number>();

  const appearMap = buildAppearMap(rounds);
  const patternIndex = buildPatternRoundIndex(appearMap, patternLen);

  for (const num of nums) {
    const pattern = getLatestIntervalPattern(appearMap, num, patternLen);
    if (!pattern) continue;

    const endRounds = patternIndex.get(pattern);
    if (!endRounds || endRounds.length < minSample) continue;

    const { freq, sampleCount } = calcNextFreqByPatternWithSample(
      rounds,
      patternIndex,
      pattern,
      minSample
    );

    const weight = Math.log2(sampleCount + 1);

    for (const [n, f] of freq.entries()) {
      score.set(n, (score.get(n) ?? 0) + f * weight);
    }
  }

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

export function getCurrentGap(
  appearMap: Map<number, number[]>,
  num: number,
  latestRound: number
): number | null {
  const rounds = appearMap.get(num);
  if (!rounds || rounds.length === 0) return null;
  return latestRound - rounds[rounds.length - 1];
}

export function getLastGap(
  appearMap: Map<number, number[]>,
  num: number,
  baseRound: number
): number | null {
  const rounds = appearMap.get(num);
  if (!rounds || rounds.length === 0) return null;

  const lastAppear = [...rounds].filter((r) => r <= baseRound).pop();
  if (!lastAppear) return null;

  // 직전 출현과의 간격
  const idx = rounds.indexOf(lastAppear);
  if (idx === 0) return null; // 범위 내 첫 출현 → 이전 간격 계산 불가

  return rounds[idx] - rounds[idx - 1];
}
