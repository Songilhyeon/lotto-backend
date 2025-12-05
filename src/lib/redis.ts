// src/lib/redis.ts
// Redis 커넥션 + 안정화 처리 + 공용 helper

import { Redis } from "ioredis";

let redis: Redis | null = null;

/**
 * Redis 연결을 싱글턴으로 유지
 */
export function getRedis() {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error("❌ REDIS_URL 이 설정되지 않았습니다.");
    }

    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      retryStrategy(times) {
        // 1초 ~ 최대 3초 backoff
        return Math.min(times * 1000, 3000);
      },
    });

    redis.on("connect", () => {
      console.log("✅ Redis 연결 성공");
    });

    redis.on("error", (err) => {
      console.error("❌ Redis 오류 발생:", err);
    });
  }

  return redis;
}

/**
 * 키 저장 (JSON 자동 변환)
 * @param key Redis key
 * @param value object 또는 primitive
 * @param ttlSeconds Optional TTL(sec)
 */
export async function redisSet(key: string, value: any, ttlSeconds?: number) {
  const client = getRedis();
  const json = JSON.stringify(value);

  if (ttlSeconds) {
    await client.set(key, json, "EX", ttlSeconds);
  } else {
    await client.set(key, json);
  }
}

/**
 * 키 조회 (JSON 자동 파싱)
 * @returns 파싱된 객체 또는 null
 */
export async function redisGet<T = any>(key: string): Promise<T | null> {
  const client = getRedis();
  const raw = await client.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as any;
  }
}

/**
 * 패턴으로 키 삭제
 * 주의: 대량 삭제 시 서버 리소스 사용량이 높을 수 있음
 */
export async function redisDeleteByPattern(pattern: string) {
  const client = getRedis();
  const stream = client.scanStream({
    match: pattern,
    count: 100,
  });

  let keysToDelete: string[] = [];

  return new Promise((resolve, reject) => {
    stream.on("data", (keys: string[]) => {
      if (keys.length > 0) {
        keysToDelete.push(...keys);
      }
    });

    stream.on("end", async () => {
      if (keysToDelete.length > 0) {
        await client.del(...keysToDelete);
      }
      resolve(true);
    });

    stream.on("error", reject);
  });
}
