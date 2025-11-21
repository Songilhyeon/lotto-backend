// lib/lottoCache.ts
import { prisma } from "../app";
import { LottoNumber } from "../types/lotto";

export const lottoCache = new Map<number, LottoNumber>();
export let sortedLottoCache: LottoNumber[] = [];

export async function getLottoData() {
  console.log(">>> 전체 로또 데이터 캐싱 시작");
  const records = await prisma.lottoNumber.findMany();
  records.forEach((record) => {
    lottoCache.set(record.drwNo, record);
  });

  sortedLottoCache = Array.from(lottoCache.values()).sort(
    (a, b) => a.drwNo - b.drwNo
  );

  console.log(`>>> 총 ${records.length}개 회차 캐싱 완료`);
  return lottoCache;
}
