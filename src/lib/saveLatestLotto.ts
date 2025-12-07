import { prisma } from "../app";
import { lottoCache, sortedLottoCache, toOptimized } from "./lottoCache";
import { redis } from "./premiumCache";

const getLottoAPI = (round: number | string) =>
  `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

/**
 * 최신 회차 로또 데이터 DB + Redis + 캐시에 저장
 */
export async function saveLatestLotto(round: number) {
  try {
    // 1. 캐시 확인
    if (lottoCache.has(round)) return lottoCache.get(round);

    // 2. DB 조회
    let record = await prisma.lottoNumber.findUnique({
      where: { drwNo: round },
    });
    if (record) {
      lottoCache.set(round, record);
      sortedLottoCache.push(toOptimized(record));
      sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);
      await redis.set(`lotto:${round}`, JSON.stringify(record));
      return record;
    }

    // 3. API fetch (5초 timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(getLottoAPI(round), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("API_FETCH_FAILED");
    const apiData = await response.json();
    if (apiData.returnValue !== "success")
      throw new Error(`ROUND_NOT_FOUND: ${round}`);

    // 4. DB 저장
    record = await prisma.lottoNumber.create({
      data: {
        drwNo: apiData.drwNo,
        drwNoDate: new Date(apiData.drwNoDate),
        drwtNo1: apiData.drwtNo1,
        drwtNo2: apiData.drwtNo2,
        drwtNo3: apiData.drwtNo3,
        drwtNo4: apiData.drwtNo4,
        drwtNo5: apiData.drwtNo5,
        drwtNo6: apiData.drwtNo6,
        bnusNo: apiData.bnusNo,
        firstPrzwnerCo: apiData.firstPrzwnerCo.toString(),
        firstWinamnt: apiData.firstWinamnt.toString(),
        totSellamnt: apiData.totSellamnt.toString(),
        firstAccumamnt: apiData.firstAccumamnt.toString(),
      },
    });

    // 5. 메모리 캐시 + Redis 저장
    lottoCache.set(round, record);
    sortedLottoCache.push(toOptimized(record));
    sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);
    await redis.set(`lotto:${round}`, JSON.stringify(record));

    console.log(`회차 ${round} 저장 완료 (DB + Redis + 캐시)`);

    return record;
  } catch (err: any) {
    if (err.name === "AbortError") console.error(`API Timeout: ${round}회차`);
    else console.error(`Error saving lotto ${round}:`, err);
    throw err;
  }
}
