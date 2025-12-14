import { prisma } from "../app";
import { LottoNumber, OptimizedLottoNumber } from "../types/lotto";
import { LottoStore } from "../types/store";

export const lottoCache = new Map<number, LottoNumber>();
export const lottoStoreCache: LottoStore[] = [];
export let sortedLottoCache: OptimizedLottoNumber[] = [];

// 최적화용 Map
export const lottoStoreByRank = new Map<number, LottoStore[]>(); // rank별
export const lottoStoreIndex = new Map<number, Map<string, LottoStore[]>>(); // rank + region별

const toNumber = (value: any): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const toOptimized = (item: LottoNumber): OptimizedLottoNumber => ({
  ...item,
  firstPrzwnerCo: toNumber(item.firstPrzwnerCo),
  firstWinamnt: toNumber(item.firstWinamnt),
  totSellamnt: toNumber(item.totSellamnt),
  firstAccumamnt: toNumber(item.firstAccumamnt),
  sum:
    toNumber(item.drwtNo1) +
    toNumber(item.drwtNo2) +
    toNumber(item.drwtNo3) +
    toNumber(item.drwtNo4) +
    toNumber(item.drwtNo5) +
    toNumber(item.drwtNo6),
});

export async function initializeLottoCache() {
  console.log(">>> 전체 로또 데이터 캐싱 시작");
  const records = await prisma.lottoNumber.findMany();
  records.forEach((record) => {
    lottoCache.set(record.drwNo, record);
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
    // 전체 배열 유지
    lottoStoreCache.push(store);

    // rank별 Map
    if (!lottoStoreByRank.has(store.rank)) {
      lottoStoreByRank.set(store.rank, []);
    }
    lottoStoreByRank.get(store.rank)!.push(store);

    // rank + region 2단계 Map
    const region = store.address.split(" ")[0] || "기타";
    if (!lottoStoreIndex.has(store.rank)) {
      lottoStoreIndex.set(store.rank, new Map());
    }
    const regionMap = lottoStoreIndex.get(store.rank)!;
    if (!regionMap.has(region)) {
      regionMap.set(region, []);
    }
    regionMap.get(region)!.push(store);
  });

  console.log(`>>> 총 ${storeRecords.length}개 판매점 캐싱 완료`);
}
