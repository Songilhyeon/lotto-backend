import { sortedLottoCache } from "../lib/lottoCache";
import Redis from "ioredis";

export interface PremiumLottoRecord {
  drwNo: number;
  numbers: number[];
  bonus: number;
  createdAt: Date;
}

export const premiumCache = new Map<number, PremiumLottoRecord>();
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

/** 초기화 */
export function initializePremiumCache() {
  premiumCache.clear();
  sortedLottoCache.forEach((item) => {
    premiumCache.set(item.drwNo, {
      drwNo: item.drwNo,
      numbers: [
        item.drwtNo1,
        item.drwtNo2,
        item.drwtNo3,
        item.drwtNo4,
        item.drwtNo5,
        item.drwtNo6,
      ],
      bonus: item.bnusNo,
      createdAt: item.drwNoDate,
    });
  });
}

export function getPremiumRound(n: number): PremiumLottoRecord | null {
  return premiumCache.get(n) ?? null;
}

export function getPremiumRounds(
  start: number,
  end: number
): PremiumLottoRecord[] {
  const arr: PremiumLottoRecord[] = [];
  for (let i = start; i <= end; i++) {
    const r = premiumCache.get(i);
    if (r) arr.push(r);
  }
  return arr;
}

export function getPremiumLatestRound(): number {
  if (premiumCache.size === 0) return 0;
  return Math.max(...premiumCache.keys());
}

/** Redis 캐시 읽기 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Redis 캐시 저장 (TTL 초 단위) */
export async function redisSet<T>(key: string, value: T, ttlSeconds = 3600) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}
