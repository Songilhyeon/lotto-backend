import { prisma } from "../app";
import {
  lottoCache,
  sortedLottoCache,
  lottoStoreByRank,
  toOptimized,
  addStoreToCache,
} from "./lottoCache";
import { redis } from "./premiumCache";
import { fetchLottoStores, LottoResult } from "./lottoCrawler";

const getLottoAPI = (round: number | string) =>
  `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

export async function saveLatestLotto(round: number) {
  try {
    if (lottoCache.has(round) && lottoStoreByRank.has(round)) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(getLottoAPI(round), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("API_FETCH_FAILED");
    const apiData = await response.json();
    if (apiData.returnValue === "fail")
      throw new Error(`ROUND_NOT_FOUND: ${round}`);

    const crawlData: LottoResult | null = await fetchLottoStores(round);

    // LottoNumber DB 저장/업데이트
    const record = await prisma.lottoNumber.upsert({
      where: { drwNo: round },
      update: {
        drwNoDate: new Date(apiData.drwNoDate),
        drwtNo1: apiData.drwtNo1,
        drwtNo2: apiData.drwtNo2,
        drwtNo3: apiData.drwtNo3,
        drwtNo4: apiData.drwtNo4,
        drwtNo5: apiData.drwtNo5,
        drwtNo6: apiData.drwtNo6,
        bnusNo: apiData.bnusNo,
        firstPrzwnerCo: String(apiData.firstPrzwnerCo ?? "0"),
        firstWinamnt: String(apiData.firstWinamnt ?? "0"),
        totSellamnt: String(apiData.totSellamnt ?? "0"),
        firstAccumamnt: String(apiData.firstAccumamnt ?? "0"),
        autoWin: crawlData?.autoWin ?? 0,
        semiAutoWin: crawlData?.semiAutoWin ?? 0,
        manualWin: crawlData?.manualWin ?? 0,
      },
      create: {
        drwNo: apiData.drwNo,
        drwNoDate: new Date(apiData.drwNoDate),
        drwtNo1: apiData.drwtNo1,
        drwtNo2: apiData.drwtNo2,
        drwtNo3: apiData.drwtNo3,
        drwtNo4: apiData.drwtNo4,
        drwtNo5: apiData.drwtNo5,
        drwtNo6: apiData.drwtNo6,
        bnusNo: apiData.bnusNo,
        firstPrzwnerCo: String(apiData.firstPrzwnerCo ?? "0"),
        firstWinamnt: String(apiData.firstWinamnt ?? "0"),
        totSellamnt: String(apiData.totSellamnt ?? "0"),
        firstAccumamnt: String(apiData.firstAccumamnt ?? "0"),
        autoWin: crawlData?.autoWin ?? 0,
        semiAutoWin: crawlData?.semiAutoWin ?? 0,
        manualWin: crawlData?.manualWin ?? 0,
      },
    });

    // LottoStore DB 저장/업데이트
    if (crawlData?.stores) {
      for (const store of crawlData.stores) {
        await prisma.lottoStore.upsert({
          where: {
            drwNo_store_address_rank: {
              drwNo: round,
              store: store.store,
              address: store.address ?? "",
              rank: store.rank ?? 0,
            },
          },
          update: {
            autoWin: store.autoWin ?? 0,
            semiAutoWin: store.semiAutoWin ?? 0,
            manualWin: store.manualWin ?? 0,
            address: store.address ?? "",
            rank: store.rank ?? 0,
          },
          create: {
            drwNo: round,
            store: store.store,
            address: store.address ?? "",
            rank: store.rank ?? 0,
            autoWin: store.autoWin ?? 0,
            semiAutoWin: store.semiAutoWin ?? 0,
            manualWin: store.manualWin ?? 0,
          },
        });

        // 메모리 캐시 업데이트 (통합 인덱스 반영)
        addStoreToCache({
          drwNo: round,
          drwNoDate: new Date(apiData.drwNoDate),
          store: store.store,
          address: store.address ?? "",
          rank: store.rank ?? 0,
          autoWin: store.autoWin ?? 0,
          semiAutoWin: store.semiAutoWin ?? 0,
          manualWin: store.manualWin ?? 0,
        });
      }
    }

    lottoCache.set(round, record);
    sortedLottoCache.push(toOptimized(record));
    sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);

    await redis.set(`lotto:${round}`, JSON.stringify(record));

    console.log(`✅ 회차 ${round} 저장 완료 (1등 + 2등 통합)`);

    return record;
  } catch (err) {
    console.error(`❌ Error saving lotto round ${round}:`, err);
    throw err;
  }
}
