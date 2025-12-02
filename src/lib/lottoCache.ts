import { prisma } from "../app";
import { LottoNumber, OptimizedLottoNumber } from "../types/lotto";

export const lottoCache = new Map<number, LottoNumber>();
export let sortedLottoCache: OptimizedLottoNumber[] = [];

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

export async function getLottoData() {
  console.log(">>> 전체 로또 데이터 캐싱 시작");
  const records = await prisma.lottoNumber.findMany();
  records.forEach((record) => {
    lottoCache.set(record.drwNo, record);
  });

  sortedLottoCache = Array.from(lottoCache.values())
    .map(toOptimized)
    .sort((a, b) => a.drwNo - b.drwNo);

  console.log(`>>> 총 ${records.length}개 회차 캐싱 완료`);
  return lottoCache;
}
