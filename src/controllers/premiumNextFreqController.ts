// controllers/premiumNextFreqController.ts
import type { Request, Response } from "express";
import type { PremiumLottoRecord } from "../lib/premiumCache"; // 프로젝트에 맞게 경로 조정
import { getPremiumRange, BASE } from "../lib/premiumCache"; // 프로젝트에 맞게!
import { getLatestRound } from "../utils/lottoUtils";

/** ---------- Types ---------- */
type RangeUnit = 5 | 7 | 10;

type CmpOp = "eq" | "gte" | "lte";
type BetweenCondition = { op: "between"; min: number; max: number };
type CountCondition = { op: CmpOp; value: number } | BetweenCondition;

type RangeCondition = {
  key: string; // ✅ 동적 key ("1-7" ...)
  op: CmpOp;
  value: number; // 0~6
};

type PremiumNextFreqConditions = {
  rangeUnit?: RangeUnit;
  ranges?: RangeCondition[];
  includeNumbers?: number[];
  excludeNumbers?: number[];

  oddCount?: CountCondition;
  sum?: CountCondition;

  consecutive?: { enabled: boolean };

  minNumber?: CountCondition;
  maxNumber?: CountCondition;
};

type PremiumNextFreqRequest = {
  startRound?: number;
  endRound?: number;
  includeBonus?: boolean;

  // ✅ NEW: range unit (최상위)
  rangeUnit?: RangeUnit;

  conditions: PremiumNextFreqConditions;

  includeMatchedRounds?: boolean;
  includeMatchedRoundsDetail?: boolean;
};

/** ---------- Constants ---------- */
const MAX_DETAIL_ITEMS = 600; // ✅ 응답 폭발 방지(필요시 조절)

/** ---------- Range bucket cache ---------- */
type RangeBucket = { key: string; min: number; max: number };

const BUCKET_CACHE = new Map<
  RangeUnit,
  {
    buckets: RangeBucket[];
    bucketMasks: Record<string, bigint>;
    emptyDist: Record<string, number>;
  }
>();

function normalizeRangeUnit(v: unknown): RangeUnit {
  const n = typeof v === "number" ? v : Number(v);
  return n === 5 || n === 7 || n === 10 ? (n as RangeUnit) : 7;
}

function makeRangeBuckets(unit: RangeUnit): RangeBucket[] {
  const buckets: RangeBucket[] = [];
  let start = 1;
  while (start <= 45) {
    const end = Math.min(45, start + unit - 1);
    buckets.push({ key: `${start}-${end}`, min: start, max: end });
    start = end + 1;
  }
  return buckets;
}

function buildRangeMask(a: number, b: number) {
  let m = 0n;
  for (let n = a; n <= b; n++) m |= 1n << BigInt(n - BASE);
  return m;
}

function buildBucketMasks(buckets: RangeBucket[]) {
  const out: Record<string, bigint> = {};
  for (const b of buckets) out[b.key] = buildRangeMask(b.min, b.max);
  return out;
}

function getBucketPack(unit: RangeUnit) {
  const u = normalizeRangeUnit(unit);
  const hit = BUCKET_CACHE.get(u);
  if (hit) return hit;

  const buckets = makeRangeBuckets(u);
  const bucketMasks = buildBucketMasks(buckets);

  const emptyDist: Record<string, number> = {};
  for (const b of buckets) emptyDist[b.key] = 0;

  const pack = { buckets, bucketMasks, emptyDist };
  BUCKET_CACHE.set(u, pack);
  return pack;
}

/** ---------- Utils ---------- */
function clamp1to45(n: number) {
  return Math.max(1, Math.min(45, Math.floor(n)));
}

/** ✅ PremiumLottoRecord용 번호 추출 */
function getNums(r: PremiumLottoRecord, includeBonus: boolean) {
  const base = (r.numbers ?? []).map(clamp1to45);
  if (includeBonus) base.push(clamp1to45(r.bonus));
  return base;
}

function uniqSortedNums(arr: unknown, maxLen = 45): number[] {
  if (!Array.isArray(arr)) return [];
  const out: number[] = [];
  for (const v of arr) {
    const n = clamp1to45(Number(v));
    if (Number.isFinite(n)) out.push(n);
    if (out.length >= maxLen) break;
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

/** BigInt bitmask popcount */
function popcountBigInt(x: bigint) {
  let c = 0;
  let v = x;
  while (v) {
    v &= v - 1n;
    c++;
  }
  return c;
}

function countInBucket(mask: bigint, bucketMask: bigint) {
  return popcountBigInt(mask & bucketMask);
}

function oddCount(nums: number[]) {
  let c = 0;
  for (const n of nums) if (n % 2 === 1) c++;
  return c;
}

function sumNums(nums: number[]) {
  let s = 0;
  for (const n of nums) s += n;
  return s;
}

function hasConsecutive(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) return true;
  }
  return false;
}

function minMax(nums: number[]) {
  let mn = 999;
  let mx = -999;
  for (const n of nums) {
    if (n < mn) mn = n;
    if (n > mx) mx = n;
  }
  return { min: mn, max: mx };
}

function matchCountCond(value: number, cond?: CountCondition) {
  if (!cond) return true;

  if ((cond as any).op === "between") {
    const c = cond as BetweenCondition;
    return value >= c.min && value <= c.max;
  }

  const c = cond as { op: CmpOp; value: number };
  if (c.op === "eq") return value === c.value;
  if (c.op === "gte") return value >= c.value;
  if (c.op === "lte") return value <= c.value;
  return true;
}

function sanitizeCountCond(
  cond: any,
  bounds: { min: number; max: number }
): CountCondition | undefined {
  if (!cond || typeof cond !== "object") return undefined;

  if (cond.op === "between") {
    const mn = Number(cond.min);
    const mx = Number(cond.max);
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return undefined;

    const a = Math.max(bounds.min, Math.floor(Math.min(mn, mx)));
    const b = Math.min(bounds.max, Math.floor(Math.max(mn, mx)));
    return { op: "between", min: a, max: b };
  }

  if (cond.op === "eq" || cond.op === "gte" || cond.op === "lte") {
    const v = Number(cond.value);
    if (!Number.isFinite(v)) return undefined;
    const vv = Math.max(bounds.min, Math.min(bounds.max, Math.floor(v)));
    return { op: cond.op, value: vv };
  }

  return undefined;
}

/** ✅ 동적 구간 조건 매칭 (unknown key는 실패) */
function matchRanges(
  mask: bigint,
  ranges: RangeCondition[] | undefined,
  bucketMasks: Record<string, bigint>
) {
  if (!ranges || ranges.length === 0) return true;

  for (const rc of ranges) {
    const bm = bucketMasks[rc.key];
    if (!bm) return false; // ✅ 안전: 모르는 key면 실패
    const cnt = countInBucket(mask, bm);

    const ok =
      rc.op === "eq"
        ? cnt === rc.value
        : rc.op === "gte"
        ? cnt >= rc.value
        : cnt <= rc.value;

    if (!ok) return false;
  }
  return true;
}

function matchIncludeExclude(
  mask: bigint,
  include?: number[],
  exclude?: number[]
) {
  if (include?.length) {
    for (const n of include) {
      const nn = clamp1to45(n);
      const bit = 1n << BigInt(nn - BASE);
      if ((mask & bit) === 0n) return false;
    }
  }
  if (exclude?.length) {
    for (const n of exclude) {
      const nn = clamp1to45(n);
      const bit = 1n << BigInt(nn - BASE);
      if ((mask & bit) !== 0n) return false;
    }
  }
  return true;
}

function matchConditions(
  nums: number[],
  mask: bigint,
  c: PremiumNextFreqConditions,
  bucketMasks: Record<string, bigint>
) {
  if (!matchRanges(mask, c.ranges, bucketMasks)) return false;
  if (!matchIncludeExclude(mask, c.includeNumbers, c.excludeNumbers))
    return false;

  if (!matchCountCond(oddCount(nums), c.oddCount)) return false;
  if (!matchCountCond(sumNums(nums), c.sum)) return false;

  if (c.consecutive?.enabled === true && !hasConsecutive(nums)) return false;
  if (c.consecutive?.enabled === false && hasConsecutive(nums)) return false;

  const mm = minMax(nums);
  if (!matchCountCond(mm.min, c.minNumber)) return false;
  if (!matchCountCond(mm.max, c.maxNumber)) return false;

  return true;
}

/** ---------- Payload parsing ---------- */
function safeParseJson<T>(v: unknown): T | null {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function parsePayload(req: Request): PremiumNextFreqRequest {
  if (req.method === "GET") {
    const startRound = req.query.startRound
      ? Number(req.query.startRound)
      : undefined;
    const endRound = req.query.endRound
      ? Number(req.query.endRound)
      : undefined;

    const includeBonus =
      typeof req.query.includeBonus === "string"
        ? req.query.includeBonus === "true"
        : undefined;

    const includeMatchedRounds =
      typeof req.query.includeMatchedRounds === "string"
        ? req.query.includeMatchedRounds === "true"
        : false;

    const includeMatchedRoundsDetail =
      typeof req.query.includeMatchedRoundsDetail === "string"
        ? req.query.includeMatchedRoundsDetail === "true"
        : false;

    const rangeUnit =
      typeof req.query.rangeUnit === "string"
        ? normalizeRangeUnit(req.query.rangeUnit)
        : undefined;

    const conditions =
      safeParseJson<PremiumNextFreqConditions>(req.query.conditions) ?? {};

    return {
      startRound,
      endRound,
      includeBonus,
      rangeUnit,
      conditions,
      includeMatchedRounds,
      includeMatchedRoundsDetail,
    };
  }

  const b = (req.body ?? {}) as PremiumNextFreqRequest;
  return {
    startRound: b.startRound,
    endRound: b.endRound,
    includeBonus: b.includeBonus,
    rangeUnit: b.rangeUnit,
    conditions: b.conditions ?? {},
    includeMatchedRounds: !!b.includeMatchedRounds,
    includeMatchedRoundsDetail: !!b.includeMatchedRoundsDetail,
  };
}

/** ---------- Conditions sanitize (stability) ---------- */
function sanitizeConditions(
  raw: any,
  bucketMasks: Record<string, bigint>
): PremiumNextFreqConditions {
  const c: PremiumNextFreqConditions =
    raw && typeof raw === "object" ? raw : {};

  const includeNumbers = uniqSortedNums(c.includeNumbers, 45);
  const excludeNumbers = uniqSortedNums(c.excludeNumbers, 45);

  // ✅ include/exclude 충돌은 서버에서 명확히 에러
  const s = new Set(includeNumbers);
  const conflicts = excludeNumbers.filter((n) => s.has(n));
  if (conflicts.length) {
    throw new Error(`include/exclude가 충돌함: ${conflicts.join(", ")}`);
  }

  // ✅ ranges sanitize + 제한
  const ranges: RangeCondition[] = [];
  if (Array.isArray(c.ranges)) {
    for (const it of c.ranges.slice(0, 20)) {
      if (!it || typeof it !== "object") continue;

      const key = String((it as any).key ?? "");
      const op = (it as any).op as CmpOp;
      const valueRaw = Number((it as any).value);

      if (!bucketMasks[key]) throw new Error(`Unknown range key: ${key}`);
      if (!(op === "eq" || op === "gte" || op === "lte"))
        throw new Error(`Invalid range op: ${String(op)}`);

      const value = Math.max(
        0,
        Math.min(6, Math.floor(Number.isFinite(valueRaw) ? valueRaw : 0))
      );

      ranges.push({ key, op, value });
    }
  }

  const consecutive =
    c.consecutive && typeof c.consecutive === "object"
      ? { enabled: !!(c.consecutive as any).enabled }
      : undefined;

  return {
    rangeUnit: c.rangeUnit,
    ranges: ranges.length ? ranges : undefined,
    includeNumbers: includeNumbers.length ? includeNumbers : undefined,
    excludeNumbers: excludeNumbers.length ? excludeNumbers : undefined,

    oddCount: sanitizeCountCond(c.oddCount, { min: 0, max: 6 }),
    sum: sanitizeCountCond(c.sum, { min: 0, max: 9999 }),
    minNumber: sanitizeCountCond(c.minNumber, { min: 1, max: 45 }),
    maxNumber: sanitizeCountCond(c.maxNumber, { min: 1, max: 45 }),

    consecutive,
  };
}

/** ---------- Controller ---------- */
export async function getPremiumNextFreqController(
  req: Request,
  res: Response
) {
  try {
    const payload = parsePayload(req);

    // ✅ rangeUnit 결정: 최상위 > conditions > 기본(7)
    const rangeUnit: RangeUnit = normalizeRangeUnit(
      payload.rangeUnit ?? payload.conditions?.rangeUnit ?? 7
    );
    const { buckets, bucketMasks, emptyDist } = getBucketPack(rangeUnit);

    // ✅ 조건 sanitize(안정성)
    const conditions = sanitizeConditions(
      payload.conditions ?? {},
      bucketMasks
    );

    // 기본값: 최신회차까지
    const latest = getLatestRound();
    const endRound = Math.floor(payload.endRound ?? latest ?? 0);
    const startRound = Math.floor(
      payload.startRound ?? Math.max(1, endRound - 500)
    );
    const includeBonus = !!payload.includeBonus;

    if (!endRound || endRound < 2) {
      return res.status(400).json({ error: "Invalid endRound" });
    }
    if (startRound <= 0 || endRound < startRound) {
      return res.status(400).json({ error: "Invalid start/end range" });
    }

    // ✅ r+1을 봐야 하므로 endRound까지 데이터 필요
    const rounds = getPremiumRange(startRound, endRound);

    const byNo = new Map<number, PremiumLottoRecord>();
    for (const r of rounds) byNo.set(r.drwNo, r);

    const matched: number[] = [];
    const matchedRounds: Array<{
      round: number;
      numbers: number[];
      nextNumbers: number[];
    }> = [];

    const nextFreq = Array.from({ length: 46 }, () => 0);

    // ✅ 동적 dist 초기화(캐시 기반)
    const nextRangeDist: Record<string, number> = { ...emptyDist };

    let nextRoundsUsed = 0;
    let detailTruncated = false;

    for (let r = startRound; r <= endRound - 1; r++) {
      const cur = byNo.get(r);
      if (!cur) continue;

      // ✅ 조건 판정은 보너스 제외 유지
      const curNums = getNums(cur, false);
      const curMask = cur.mask;

      if (!matchConditions(curNums, curMask, conditions, bucketMasks)) continue;

      matched.push(r);

      const nxt = byNo.get(r + 1);
      if (!nxt) {
        if (payload.includeMatchedRoundsDetail) {
          if (matchedRounds.length < MAX_DETAIL_ITEMS) {
            matchedRounds.push({ round: r, numbers: curNums, nextNumbers: [] });
          } else {
            detailTruncated = true;
          }
        }
        continue;
      }

      nextRoundsUsed++;

      const nxtNums = getNums(nxt, includeBonus);

      // ✅ 상세 리스트 제한
      if (payload.includeMatchedRoundsDetail) {
        if (matchedRounds.length < MAX_DETAIL_ITEMS) {
          matchedRounds.push({
            round: r,
            numbers: curNums,
            nextNumbers: nxtNums,
          });
        } else {
          detailTruncated = true;
        }
      }

      // ✅ nextFreq 집계
      for (const n of nxtNums) {
        if (n >= 1 && n <= 45) nextFreq[n] += 1;
      }

      // ✅ 구간 분포 집계 (동적)
      const nxtMask = includeBonus ? nxt.bonusMask : nxt.mask;
      for (const b of buckets) {
        nextRangeDist[b.key] += countInBucket(nxtMask, bucketMasks[b.key]);
      }
    }

    const top: { num: number; count: number }[] = [];
    for (let n = 1; n <= 45; n++) top.push({ num: n, count: nextFreq[n] });
    top.sort((a, b) => b.count - a.count || a.num - b.num);

    const nextNumberFreq: Record<number, number> = {};
    for (let n = 1; n <= 45; n++) nextNumberFreq[n] = nextFreq[n];

    // ✅ 보기 좋게: 최신 회차가 위로
    if (payload.includeMatchedRoundsDetail) {
      matchedRounds.sort((a, b) => b.round - a.round);
    }

    return res.status(200).json({
      data: {
        meta: {
          startRound,
          endRound,
          includeBonus,
          matchedRounds: matched.length,
          nextRoundsUsed,
          rangeUnit, // ✅ 프런트가 결과 렌더에 사용
          detailTruncated,
          detailLimit: payload.includeMatchedRoundsDetail
            ? MAX_DETAIL_ITEMS
            : undefined,
        },
        nextNumberFreq,
        top: top.slice(0, 12),
        nextRangeDist,

        ...(payload.includeMatchedRounds ? { matchedRoundList: matched } : {}),
        ...(payload.includeMatchedRoundsDetail ? { matchedRounds } : {}),
      },
    });
  } catch (e: any) {
    console.error("[getPremiumNextFreqController] error:", e);
    // sanitizeConditions에서 throw한 에러도 여기로 옴
    return res.status(500).json({ error: e?.message ?? "Server error" });
  }
}
