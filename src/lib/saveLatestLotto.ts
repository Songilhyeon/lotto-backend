import { prisma } from "../app";
import {
  lottoCache,
  sortedLottoCache,
  lottoStoreByRank,
  toOptimized,
  addStoreToCache,
} from "./lottoCache";
import { fetchLottoStores, LottoResult } from "./lottoCrawler";

const getLottoAPI = (round: number | string) =>
  `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${round}`;

// ✅ 새 응답(data.list[0]) / 구 응답을 모두 지원하는 파서
function parseLottoApi(apiData: any) {
  // 신형
  const row = apiData?.data?.list?.[0];
  if (row) {
    return {
      drwNo: Number(row.ltEpsd),
      drwNoDate: String(row.ltRflYmd), // "YYYYMMDD"
      nums: [
        Number(row.tm1WnNo),
        Number(row.tm2WnNo),
        Number(row.tm3WnNo),
        Number(row.tm4WnNo),
        Number(row.tm5WnNo),
        Number(row.tm6WnNo),
      ],
      bonus: Number(row.bnsWnNo),

      // ✅ 자동/수동/반자동은 여기서 확정
      // (필요하면 매핑만 바꾸면 됨)
      autoWin: Number(row.winType1 ?? 0),
      manualWin: Number(row.winType2 ?? 0),
      semiAutoWin: Number(row.winType3 ?? 0),

      // 당첨 관련
      firstPrzwnerCo: String(row.rnk1WnNope ?? "0"),
      firstWinamnt: String(row.rnk1WnAmt ?? "0"),
      firstAccumamnt: String(row.rnk1SumWnAmt ?? "0"),

      secondPrzwnerCo: String(row.rnk2WnNope ?? "0"),
      secondWinamnt: String(row.rnk2WnAmt ?? "0"),
      secondAccumamnt: String(row.rnk2SumWnAmt ?? "0"),

      totSellamnt: String(row.rlvtEpsdSumNtslAmt ?? "0"), // 회차 판매금액(네가 쓰던 필드 목적에 맞게)
    };
  }

  // 구형(기존 코드 유지)
  if (apiData?.returnValue === "fail") return null;

  return {
    drwNo: Number(apiData.drwNo),
    drwNoDate: String(apiData.drwNoDate), // "YYYY-MM-DD"
    nums: [
      Number(apiData.drwtNo1),
      Number(apiData.drwtNo2),
      Number(apiData.drwtNo3),
      Number(apiData.drwtNo4),
      Number(apiData.drwtNo5),
      Number(apiData.drwtNo6),
    ],
    bonus: Number(apiData.bnusNo),

    autoWin: 0,
    manualWin: 0,
    semiAutoWin: 0,

    firstPrzwnerCo: String(apiData.firstPrzwnerCo ?? "0"),
    firstWinamnt: String(apiData.firstWinamnt ?? "0"),
    firstAccumamnt: String(apiData.firstAccumamnt ?? "0"),
    secondPrzwnerCo: String(apiData.secondPrzwnerCo ?? "0"),
    secondWinamnt: String(apiData.secondWinamnt ?? "0"),
    secondAccumamnt: String(apiData.secondAccumamnt ?? "0"),
    totSellamnt: String(apiData.totSellamnt ?? "0"),
  };
}

function parseDate(d: string) {
  // 신형: "YYYYMMDD"
  if (/^\d{8}$/.test(d)) {
    const y = d.slice(0, 4);
    const m = d.slice(4, 6);
    const day = d.slice(6, 8);
    return new Date(`${y}-${m}-${day}T00:00:00+09:00`);
  }
  // 구형: "YYYY-MM-DD"
  return new Date(d);
}

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

    const parsed = parseLottoApi(apiData);
    if (!parsed) throw new Error(`ROUND_NOT_FOUND: ${round}`);

    // ✅ 판매점은 store 테이블 저장용(자동/수동/반자동 집계는 사용 X)
    const storeData: LottoResult | null = await fetchLottoStores(round);

    const drwNoDateObj = parseDate(parsed.drwNoDate);

    const record = await prisma.lottoNumber.upsert({
      where: { drwNo: round },
      update: {
        drwNoDate: drwNoDateObj,
        drwtNo1: parsed.nums[0],
        drwtNo2: parsed.nums[1],
        drwtNo3: parsed.nums[2],
        drwtNo4: parsed.nums[3],
        drwtNo5: parsed.nums[4],
        drwtNo6: parsed.nums[5],
        bnusNo: parsed.bonus,

        firstPrzwnerCo: parsed.firstPrzwnerCo,
        firstWinamnt: parsed.firstWinamnt,
        totSellamnt: parsed.totSellamnt,
        firstAccumamnt: parsed.firstAccumamnt,
        secondPrzwnerCo: parsed.secondPrzwnerCo,
        secondWinamnt: parsed.secondWinamnt,
        secondAccumamnt: parsed.secondAccumamnt,

        // ✅ 여기 핵심: winType 기반
        autoWin: parsed.autoWin,
        semiAutoWin: parsed.semiAutoWin,
        manualWin: parsed.manualWin,
      },
      create: {
        drwNo: parsed.drwNo,
        drwNoDate: drwNoDateObj,
        drwtNo1: parsed.nums[0],
        drwtNo2: parsed.nums[1],
        drwtNo3: parsed.nums[2],
        drwtNo4: parsed.nums[3],
        drwtNo5: parsed.nums[4],
        drwtNo6: parsed.nums[5],
        bnusNo: parsed.bonus,

        firstPrzwnerCo: parsed.firstPrzwnerCo,
        firstWinamnt: parsed.firstWinamnt,
        totSellamnt: parsed.totSellamnt,
        firstAccumamnt: parsed.firstAccumamnt,
        secondPrzwnerCo: parsed.secondPrzwnerCo,
        secondWinamnt: parsed.secondWinamnt,
        secondAccumamnt: parsed.secondAccumamnt,

        autoWin: parsed.autoWin,
        semiAutoWin: parsed.semiAutoWin,
        manualWin: parsed.manualWin,
      },
    });

    // ✅ store 테이블 저장(기존 그대로)
    if (storeData?.stores) {
      for (const store of storeData.stores) {
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

        addStoreToCache({
          drwNo: round,
          drwNoDate: drwNoDateObj,
          store: store.store,
          address: store.address ?? "",
          rank: store.rank ?? 0,
          autoWin: 0,
          semiAutoWin: 0,
          manualWin: 0,
        });
      }
    }

    lottoCache.set(round, record);
    sortedLottoCache.push(toOptimized(record));
    sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);

    console.log(`✅ 회차 ${round} 저장 완료 (번호API winType + 판매점JSON)`);

    return record;
  } catch (err) {
    console.error(`❌ Error saving lotto round ${round}:`, err);
    throw err;
  }
}
