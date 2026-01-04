import { prisma } from "../app";
import { LottoNumber, OptimizedLottoNumber } from "../types/lotto";
import { LottoStore } from "../types/store";

export const lottoCache = new Map<number, LottoNumber>();
export const lottoStoreCache: LottoStore[] = [];
export let sortedLottoCache: OptimizedLottoNumber[] = [];
export const drwNoDateByRound = new Map<number, Date>();

// 최적화용 Map
export const lottoStoreByRank = new Map<number, LottoStore[]>(); // rank별
export const lottoStoreIndex = new Map<number, Map<string, LottoStore[]>>(); // rank + region별

// ✅ store + address 기반 O(1) 인덱스
export const lottoStoreByIdentity = new Map<string, LottoStore[]>();

const toNumber = (value: any): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// ✅ null이면 null, 값이 있으면 number로
const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// ✅ 문자열 정규화 (중요)
const normalize = (v: string) => v.replace(/\s+/g, " ").trim();

export const toOptimized = (item: LottoNumber): OptimizedLottoNumber => ({
  ...item,

  // 1등
  firstPrzwnerCo: toNumber(item.firstPrzwnerCo),
  firstWinamnt: toNumber(item.firstWinamnt),
  totSellamnt: toNumber(item.totSellamnt),
  firstAccumamnt: toNumber(item.firstAccumamnt),

  // ✅ 2등: 방법 A에서는 string | null 이므로 null을 보존해야 "0" 가짜값이 안 생김
  secondPrzwnerCo: toNumberOrNull(item.secondPrzwnerCo),
  secondWinamnt: toNumberOrNull(item.secondWinamnt),
  secondAccumamnt: toNumberOrNull(item.secondAccumamnt),

  sum:
    toNumber(item.drwtNo1) +
    toNumber(item.drwtNo2) +
    toNumber(item.drwtNo3) +
    toNumber(item.drwtNo4) +
    toNumber(item.drwtNo5) +
    toNumber(item.drwtNo6),
});

export async function initializeLottoCache() {
  console.log(">>> 전체 데이터 캐싱 시작");

  const records = await prisma.lottoNumber.findMany();

  records.forEach((record) => {
    // ✅ 방법 A 적용 후에는 Prisma record 타입이 LottoNumber와 호환됨 (2등이 null로 들어옴)
    lottoCache.set(record.drwNo, record as unknown as LottoNumber);

    if (record.drwNoDate instanceof Date) {
      drwNoDateByRound.set(record.drwNo, record.drwNoDate);
    }
  });

  sortedLottoCache = Array.from(lottoCache.values())
    .map(toOptimized)
    .sort((a, b) => a.drwNo - b.drwNo);

  console.log(`>>> 총 ${records.length}개 회차 당첨번호 캐싱 완료`);

  // -----------------------------
  // 2️⃣ LottoStore 캐시 최적화
  // -----------------------------
  const storeRecords = await prisma.lottoStore.findMany();

  storeRecords.forEach((store) => {
    const drwNoDate = drwNoDateByRound.get(store.drwNo) ?? null;

    const storeWithDate: LottoStore & { drwNoDate: Date | null } = {
      ...store,
      drwNoDate,
    };

    // -----------------------------
    // 전체 캐시
    // -----------------------------
    lottoStoreCache.push(storeWithDate);

    // -----------------------------
    // ✅ store + address identity 인덱스
    // -----------------------------
    if (
      typeof storeWithDate.store === "string" &&
      typeof storeWithDate.address === "string"
    ) {
      const key = `${normalize(storeWithDate.store)}|${normalize(
        storeWithDate.address
      )}`;

      if (!lottoStoreByIdentity.has(key)) {
        lottoStoreByIdentity.set(key, []);
      }
      lottoStoreByIdentity.get(key)!.push(storeWithDate);
    }

    // -----------------------------
    // rank별 Map
    // -----------------------------
    if (!lottoStoreByRank.has(storeWithDate.rank)) {
      lottoStoreByRank.set(storeWithDate.rank, []);
    }
    lottoStoreByRank.get(storeWithDate.rank)!.push(storeWithDate);

    // -----------------------------
    // rank + region 2단계 Map
    // -----------------------------
    const region =
      typeof storeWithDate.address === "string"
        ? storeWithDate.address.split(" ")[0]
        : "기타";

    if (!lottoStoreIndex.has(storeWithDate.rank)) {
      lottoStoreIndex.set(storeWithDate.rank, new Map());
    }
    const regionMap = lottoStoreIndex.get(storeWithDate.rank)!;

    if (!regionMap.has(region)) {
      regionMap.set(region, []);
    }
    regionMap.get(region)!.push(storeWithDate);
  });

  console.log(
    `>>> 총 ${storeRecords.length}개 판매점 캐싱 완료 (identity index 포함)`
  );
}

export function addStoreToCache(
  store: LottoStore & { drwNoDate: Date | null }
) {
  if (
    lottoStoreCache.some(
      (s) =>
        s.drwNo === store.drwNo &&
        s.store === store.store &&
        s.address === store.address &&
        s.rank === store.rank
    )
  ) {
    return;
  }

  // 전체 캐시
  lottoStoreCache.push(store);

  // identity index
  if (store.store && store.address) {
    const key = `${normalize(store.store)}|${normalize(store.address)}`;
    if (!lottoStoreByIdentity.has(key)) {
      lottoStoreByIdentity.set(key, []);
    }
    lottoStoreByIdentity.get(key)!.push(store);
  }

  // rank별
  if (!lottoStoreByRank.has(store.rank)) {
    lottoStoreByRank.set(store.rank, []);
  }
  lottoStoreByRank.get(store.rank)!.push(store);

  // rank + region
  const region =
    typeof store.address === "string" ? store.address.split(" ")[0] : "기타";

  if (!lottoStoreIndex.has(store.rank)) {
    lottoStoreIndex.set(store.rank, new Map());
  }
  const regionMap = lottoStoreIndex.get(store.rank)!;

  if (!regionMap.has(region)) {
    regionMap.set(region, []);
  }
  regionMap.get(region)!.push(store);
}
