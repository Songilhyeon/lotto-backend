// premiumCache.ts + AI 추천 기능 확장 (Bitmask 기반 완전 최적화 버전)

import { sortedLottoCache } from "../lib/lottoCache";
import Redis from "ioredis";

export const BASE = 1; // 1 → 번호 1이 비트 0에 대응 / 0 → 0이 비트 0에 대응

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

/** Redis */
export const redis = new Redis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

/* ------------------------------------------------------
 * Bitmask Utility — BASE 적용 버전
 * ------------------------------------------------------ */
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

// 비트로 특정 번호 포함 여부 — BASE 적용
export function maskHas(mask: bigint, n: number): boolean {
  const shift = BigInt(n - BASE);
  if (shift < 0n) return false;
  return (mask & (1n << shift)) !== 0n;
}

/* ------------------------------------------------------
 * 초기화
 * ------------------------------------------------------ */
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

  // 2) nextMask / nextBonusMask 연결 (mask는 이미 BASE 적용됨 → 그대로 복사)
  for (const [no, rec] of premiumCache) {
    const next = premiumCache.get(no + 1);
    if (!next) continue;

    rec.nextMask = next.mask;
    rec.nextBonusMask = next.bonusMask;
  }

  console.log("[premiumCache] initialized:", premiumCache.size);
}

/* ------------------------------------------------------
 * Getter
 * ------------------------------------------------------ */
export function getPremiumRound(n: number): PremiumLottoRecord | null {
  return premiumCache.get(n) ?? null;
}

export function getPremiumLatestRound(): number {
  return premiumCache.size > 0 ? Math.max(...premiumCache.keys()) : 0;
}

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

/* ------------------------------------------------------
 * Redis utils
 * ------------------------------------------------------ */
export async function redisGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function redisSet<T>(key: string, value: T, ttl = 3600) {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
}

/* ------------------------------------------------------
 * AI 추천 엔진 — BASE 반영한 maskHas 사용
 * ------------------------------------------------------ */
export interface AiNextPredictionResult {
  numbers: number[];
  scoreMap: Record<number, number>;
}

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

    const nm = r.nextMask;

    for (let n = 1; n <= 45; n++) {
      if (maskHas(nm, n)) {
        score[n] += weight;
      }
    }

    idx++;
  }

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
