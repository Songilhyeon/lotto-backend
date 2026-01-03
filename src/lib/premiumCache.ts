// Bitmask 기반 메모리 캐시
import { sortedLottoCache } from "../lib/lottoCache";

export const BASE = 1; // 1 → 번호 1이 비트 0에 대응

/**
 * 각 회차 기록 구조
 */
export interface PremiumLottoRecord {
  drwNo: number;
  numbers: number[];
  bonus: number;

  // bitmask
  mask: bigint; // 6개 번호
  bonusMask: bigint; // 6개 + 보너스

  nextMask: bigint; // 다음 회차 6개 번호 mask
  nextBonusMask: bigint; // 다음 회차 6개 + 보너스 mask

  createdAt: Date;
}

/** 메모리 캐시 */
export const premiumCache = new Map<number, PremiumLottoRecord>();

/* ------------------------------------------------------
 * Bitmask Utility — BASE 적용 버전
 * ------------------------------------------------------ */

/**
 * 숫자 배열을 비트마스크로 변환
 * @param nums 번호 배열 (1-45)
 * @param includeBonus 보너스 번호 (옵션)
 */
export function numbersToMask(nums: number[], includeBonus?: number): bigint {
  let mask = 0n;

  nums.forEach((n) => {
    const shift = BigInt(n - BASE);
    if (shift >= 0n) mask |= 1n << shift;
  });

  if (includeBonus !== undefined) {
    const shift = BigInt(includeBonus - BASE);
    if (shift >= 0n) mask |= 1n << shift;
  }

  return mask;
}

/**
 * 비트마스크에 특정 번호가 포함되어 있는지 확인
 * @param mask 비트마스크
 * @param n 확인할 번호 (1-45)
 */
export function maskHas(mask: bigint, n: number): boolean {
  const shift = BigInt(n - BASE);
  if (shift < 0n) return false;
  return (mask & (1n << shift)) !== 0n;
}

/**
 * 비트마스크를 숫자 배열로 변환
 * @param mask 비트마스크
 */
export function maskToNumbers(mask: bigint): number[] {
  const numbers: number[] = [];
  for (let n = 1; n <= 45; n++) {
    if (maskHas(mask, n)) {
      numbers.push(n);
    }
  }
  return numbers;
}

/**
 * 두 비트마스크의 교집합 개수 계산
 * @param mask1 첫 번째 마스크
 * @param mask2 두 번째 마스크
 */
export function maskIntersectionCount(mask1: bigint, mask2: bigint): number {
  let count = 0;
  let intersection = mask1 & mask2;

  while (intersection > 0n) {
    intersection &= intersection - 1n;
    count++;
  }

  return count;
}

/* ------------------------------------------------------
 * 초기화
 * ------------------------------------------------------ */

/**
 * 로또 캐시를 기반으로 프리미엄 캐시 초기화
 * - 각 회차의 비트마스크 생성
 * - 다음 회차 참조 연결
 */
export function initializePremiumCache() {
  premiumCache.clear();

  // 1) 기본 회차 저장 (mask, bonusMask)
  sortedLottoCache.forEach((item) => {
    const nums = [
      item.drwtNo1,
      item.drwtNo2,
      item.drwtNo3,
      item.drwtNo4,
      item.drwtNo5,
      item.drwtNo6,
    ];

    const mask = numbersToMask(nums);
    const bonusMask = numbersToMask(nums, item.bnusNo);

    premiumCache.set(item.drwNo, {
      drwNo: item.drwNo,
      numbers: nums,
      bonus: item.bnusNo,
      mask,
      bonusMask,
      nextMask: 0n,
      nextBonusMask: 0n,
      createdAt: item.drwNoDate,
    });
  });

  // 2) nextMask / nextBonusMask 연결
  for (const [no, rec] of premiumCache) {
    const next = premiumCache.get(no + 1);
    if (!next) continue;

    rec.nextMask = next.mask;
    rec.nextBonusMask = next.bonusMask;
  }

  console.log(`[PremiumCache] Initialized with ${premiumCache.size} rounds`);
}

/* ------------------------------------------------------
 * Getter
 * ------------------------------------------------------ */

/**
 * 특정 회차 데이터 조회
 */
export function getPremiumRound(n: number): PremiumLottoRecord | null {
  return premiumCache.get(n) ?? null;
}

/**
 * 최신 회차 번호 조회
 */
export function getPremiumLatestRound(): number {
  return premiumCache.size > 0 ? Math.max(...premiumCache.keys()) : 0;
}

/**
 * 특정 범위의 회차 데이터 조회
 * @param start 시작 회차
 * @param end 종료 회차
 */
export function getPremiumRange(
  start: number,
  end: number
): PremiumLottoRecord[] {
  const res: PremiumLottoRecord[] = [];
  for (let i = start; i <= end; i++) {
    const r = premiumCache.get(i);
    if (r) res.push(r);
  }
  return res;
}

/**
 * 전체 회차 데이터 조회 (정렬된 배열)
 */
export function getAllPremiumRounds(): PremiumLottoRecord[] {
  return Array.from(premiumCache.values()).sort((a, b) => a.drwNo - b.drwNo);
}

/* ------------------------------------------------------
 * AI 점수계산 엔진
 * ------------------------------------------------------ */

export interface AiNextPredictionResult {
  numbers: number[];
  scoreMap: Record<number, number>;
}

/**
 * 과거 패턴 기반 다음 회차 예측
 * - 최근 회차일수록 높은 가중치 적용
 * - 각 번호의 출현 빈도에 가중치를 곱하여 점수 계산
 */
export function computeAiNextPrediction(): AiNextPredictionResult {
  const latest = getPremiumLatestRound();
  const range = getPremiumRange(1, latest - 1);

  // 번호별 점수 초기화
  const score: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) score[i] = 0;

  const total = range.length;

  // 각 회차의 다음 회차 번호에 가중치 적용
  range.forEach((r, idx) => {
    // 최근 회차일수록 가중치 증가 (1.0 ~ 2.0)
    const weight = 1 + idx / total;

    const nm = r.nextMask;

    // 다음 회차에 출현한 번호들에 가중치만큼 점수 부여
    for (let n = 1; n <= 45; n++) {
      if (maskHas(nm, n)) {
        score[n] += weight;
      }
    }
  });

  // 점수가 높은 상위 6개 번호 추출
  const recommended = Object.entries(score)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);

  return {
    numbers: recommended,
    scoreMap: score,
  };
}

/* ------------------------------------------------------
 * 통계 유틸리티
 * ------------------------------------------------------ */

/**
 * 캐시 통계 정보 조회
 */
export function getCacheStats() {
  const rounds = Array.from(premiumCache.values());

  if (rounds.length === 0) {
    return {
      totalRounds: 0,
      firstRound: 0,
      lastRound: 0,
      averageNumbersPerRound: 0,
    };
  }

  const firstRound = Math.min(...premiumCache.keys());
  const lastRound = Math.max(...premiumCache.keys());

  return {
    totalRounds: rounds.length,
    firstRound,
    lastRound,
    dateRange: {
      from: premiumCache.get(firstRound)?.createdAt,
      to: premiumCache.get(lastRound)?.createdAt,
    },
  };
}

/**
 * 특정 번호의 출현 빈도 분석
 * @param number 분석할 번호 (1-45)
 */
export function analyzeNumberFrequency(number: number): {
  totalAppearances: number;
  asBonus: number;
  asMain: number;
  lastAppearance: number | null;
} {
  let totalAppearances = 0;
  let asBonus = 0;
  let asMain = 0;
  let lastAppearance: number | null = null;

  for (const [drwNo, record] of premiumCache) {
    if (maskHas(record.mask, number)) {
      totalAppearances++;
      asMain++;
      lastAppearance = drwNo;
    } else if (record.bonus === number) {
      totalAppearances++;
      asBonus++;
      lastAppearance = drwNo;
    }
  }

  return {
    totalAppearances,
    asBonus,
    asMain,
    lastAppearance,
  };
}
