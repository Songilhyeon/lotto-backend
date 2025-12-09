// premiumCache.ts + AI 추천 기능 확장 (Bitmask 기반 완전 최적화 버전)

import { sortedLottoCache } from "../lib/lottoCache";
import Redis from "ioredis";

/**
 * 각 회차의 최적 구조
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

/** 메모리 캐시 (비트마스크 포함) */
export const premiumCache = new Map<number, PremiumLottoRecord>();

/** Redis */
export const redis = new Redis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

// ------------------------------------------------------
// Bitmask Utility
// ------------------------------------------------------
export function numbersToMask(nums: number[], includeBonus?: number): bigint {
  let mask = 0n;
  nums.forEach((n) => (mask |= 1n << BigInt(n)));
  if (includeBonus) mask |= 1n << BigInt(includeBonus);
  return mask;
}

// 비트로 특정 번호 포함 여부
export function maskHas(mask: bigint, n: number): boolean {
  return (mask & (1n << BigInt(n))) !== 0n;
}

// ------------------------------------------------------
// 초기화
// ------------------------------------------------------
export function initializePremiumCache() {
  premiumCache.clear();

  // 1) 기본 회차 저장(mask, bonusMask)
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

  console.log("[premiumCache] initialized:", premiumCache.size);
}

// ------------------------------------------------------
// Getter
// ------------------------------------------------------
export function getPremiumRound(n: number): PremiumLottoRecord | null {
  return premiumCache.get(n) ?? null;
}

export function getPremiumLatestRound(): number {
  return premiumCache.size > 0 ? Math.max(...premiumCache.keys()) : 0;
}

// 최적화된 범위 조회
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

// ------------------------------------------------------
// Redis utils
// ------------------------------------------------------
export async function redisGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function redisSet<T>(key: string, value: T, ttl = 3600) {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
}

// ------------------------------------------------------
// "AI" 통계 기반 추천 엔진 (비용 無 — 내부 계산)
// ------------------------------------------------------
/**
 * 다음 회차 등장 확률 계산용 구조
 */
export interface AiNextPredictionResult {
  numbers: number[]; // 추천 번호 6개
  scoreMap: Record<number, number>; // 번호별 점수
}

/**
 * 번호별 다음 회차 등장 확률 계산
 * - nextMask 기반 → "어떤 번호 뒤에 어떤 번호가 오나"를 전수통계
 * - 최근 회차 가중치 적용
 */
export function computeAiNextPrediction(): AiNextPredictionResult {
  const latest = getPremiumLatestRound();
  const range = getPremiumRange(1, latest - 1);

  // 번호별 점수
  const score: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) score[i] = 0;

  let idx = 0;
  const total = range.length;

  for (const r of range) {
    const weight = 1 + idx / total; // 최근일수록 가중치 ↑

    // 다음 회차 번호들의 mask
    const nm = r.nextMask;

    for (let n = 1; n <= 45; n++) {
      if (maskHas(nm, n)) {
        score[n] += weight;
      }
    }

    idx++;
  }

  // 상위 6개 번호 추천
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
