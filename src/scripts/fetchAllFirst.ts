// 실행: npx ts-node src/scripts/updateFirstStores.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 주소 정규화: 공백 정리 + 연속 토큰 중복 제거 + tail 반복 제거 */
function normalizeAddress(raw: string) {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // 1) 연속으로 같은 토큰이 반복되면 제거
  const tokens = s.split(" ");
  const out: string[] = [];
  for (const t of tokens) {
    if (out.length > 0 && out[out.length - 1] === t) continue;
    out.push(t);
  }

  // 2) 마지막 1~4 토큰이 그대로 한 번 더 반복되면 제거
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
  atmtPsvYnTxt?: string; // 1등: 자동/수동/반자동 의미 있음
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

function applyTypeCount(
  agg: { autoWin: number; semiAutoWin: number; manualWin: number },
  typeTxt?: string
) {
  const t = (typeTxt ?? "").trim();
  if (t.includes("반자동")) agg.semiAutoWin += 1;
  else if (t.includes("수동")) agg.manualWin += 1;
  else if (t.includes("자동")) agg.autoWin += 1;
  else agg.autoWin += 1; // 값이 이상하면 안전하게 자동 처리
}

async function fetchFirstStores(round: number) {
  const url = getWinnerShopAPI(round, 1);
  const json = await fetchJsonWithTimeout<WnShopResponse>(url);
  const list = json?.data?.list ?? [];
  if (!Array.isArray(list) || list.length === 0) return [];

  // (store|address) 단위로 중복 누적
  const map = new Map<
    string,
    {
      store: string;
      address: string;
      autoWin: number;
      semiAutoWin: number;
      manualWin: number;
    }
  >();

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
    applyTypeCount(map.get(key)!, item.atmtPsvYnTxt);
  }

  return Array.from(map.values());
}

async function main() {
  const START = 262;
  const END = 1205;

  console.log(`🔥 1등 판매점 완전 덮어쓰기 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      // ✅ 1) 기존 1등 데이터 완전 삭제
      await prisma.lottoStore.deleteMany({
        where: { drwNo: round, rank: 1 },
      });

      // ✅ 2) 새로 가져오기 (주소 정규화 포함)
      const stores = await fetchFirstStores(round);

      if (stores.length === 0) {
        console.warn(`⚠️ 회차 ${round} 1등 판매점 없음 → 스킵`);
        continue;
      }

      // ✅ 3) 재삽입
      for (const s of stores) {
        await prisma.lottoStore.create({
          data: {
            drwNo: round,
            rank: 1,
            store: s.store,
            address: s.address,
            autoWin: s.autoWin,
            semiAutoWin: s.semiAutoWin,
            manualWin: s.manualWin,
          },
        });
      }

      console.log(`✔ 1등 저장 완료: ${round}회 ${stores.length}건`);
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.error(`❌ 회차 ${round} 1등 저장 실패`, err);
    }
  }

  console.log("🎉 1등 판매점 업데이트 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
