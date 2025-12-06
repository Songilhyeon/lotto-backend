// premiumCache.ts (완전 최적화 Bitmask 버전)

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
