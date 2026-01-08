// 실행: npx ts-node src/scripts/fetchAllSecond.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 주소 정규화: 공백 정리 + 연속 토큰 중복 제거 + tail 반복 제거 */
function normalizeAddress(raw: string) {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  const tokens = s.split(" ");
  const out: string[] = [];
  for (const t of tokens) {
    if (out.length > 0 && out[out.length - 1] === t) continue;
    out.push(t);
  }

  const dedupTail = (arr: string[]) => {
    for (let k = 1; k <= 4; k++) {
      if (arr.length >= 2 * k) {
        const tail = arr.slice(-k).join(" ");
        const prev = arr.slice(-2 * k, -k).join(" ");
        if (tail === prev) return arr.slice(0, -k);
      }
    }
    return arr;
  };

  return dedupTail(out).join(" ").trim();
}

type WnShopItem = {
  shpNm?: string;
  shpAddr?: string;
  atmtPsvYnTxt?: string | null; // ✅ 이번 회차부터 2등도 들어올 수 있음
};

type WnShopResponse = {
  resultCode: string | null;
  resultMessage: string | null;
  data?: { total?: number; list?: WnShopItem[] };
};

const getWinnerShopAPI = (round: number, rank: 1 | 2) =>
  `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=${rank}&srchLtEpsd=${round}`;

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json, text/plain, */*" },
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

type StoreAgg = {
  store: string;
  address: string;
  autoWin: number;
  semiAutoWin: number;
  manualWin: number;
};

function applyStoreTypeForSecond(store: StoreAgg, typeTxt?: string | null) {
  const t = (typeTxt ?? "").trim();

  // ✅ 타입 정보가 있으면 분리 저장 시도
  if (t) {
    if (t.includes("반자동")) {
      store.semiAutoWin += 1;
      return;
    }
    if (t.includes("수동")) {
      store.manualWin += 1;
      return;
    }
    if (t.includes("자동")) {
      store.autoWin += 1;
      return;
    }

    // ✅ 타입 문자열은 있는데 모르는 값이면 호환을 위해 auto로 누적
    store.autoWin += 1;
    return;
  }

  // ✅ 타입이 없으면(레거시) 기존처럼 autoWin에 총합 누적
  store.autoWin += 1;
}

async function fetchSecondStores(round: number) {
  const url = getWinnerShopAPI(round, 2);
  const json = await fetchJsonWithTimeout<WnShopResponse>(url);
  const list = json?.data?.list ?? [];
  if (!Array.isArray(list) || list.length === 0) return [];

  // (store|address) 단위로 auto/semi/manual 누적 (타입 없으면 auto에 총합 누적)
  const map = new Map<string, StoreAgg>();

  for (const item of list) {
    const store = (item.shpNm ?? "").replace(/\s+/g, " ").trim();
    const address = normalizeAddress(item.shpAddr ?? "");
    if (!store || !address) continue;

    const key = `${store}|${address}`;
    if (!map.has(key)) {
      map.set(key, {
        store,
        address,
        autoWin: 0,
        semiAutoWin: 0,
        manualWin: 0,
      });
    }

    applyStoreTypeForSecond(map.get(key)!, item.atmtPsvYnTxt);
  }

  return Array.from(map.values());
}

async function main() {
  const START = 1205;
  const END = 1205;

  console.log(`🔥 2등 판매점 완전 덮어쓰기 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      // ✅ 1) 기존 2등 데이터 완전 삭제
      await prisma.lottoStore.deleteMany({
        where: { drwNo: round, rank: 2 },
      });

      // ✅ 2) 새로 가져오기 (주소 정규화 포함)
      const stores = await fetchSecondStores(round);

      if (stores.length === 0) {
        console.warn(`⚠️ 회차 ${round} 2등 판매점 없음 → 스킵`);
        continue;
      }

      // ✅ 3) 재삽입
      for (const s of stores) {
        await prisma.lottoStore.create({
          data: {
            drwNo: round,
            rank: 2,
            store: s.store,
            address: s.address,

            // ✅ 이제 2등도 타입 정보가 있으면 분리 저장
            // ✅ 타입 정보가 없었던 과거 회차는 autoWin에 "총합"이 들어가게 됨 (레거시 호환)
            autoWin: s.autoWin,
            semiAutoWin: s.semiAutoWin,
            manualWin: s.manualWin,
          },
        });
      }

      console.log(`✔ 2등 저장 완료: ${round}회 ${stores.length}건`);
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.error(`❌ 회차 ${round} 2등 저장 실패`, err);
    }
  }

  console.log("🎉 2등 판매점 업데이트 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
