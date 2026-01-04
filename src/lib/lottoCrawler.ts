// lottoCrawler.ts (JSON 판매점 API 기반 - stores 저장용)
export interface LottoStoreInfo {
  rank: number; // 1 | 2
  store: string;
  address: string;

  // 이제 이 3개는 "번호 API(winType*)"에서 가져오므로 여기서는 의미없음(0 유지)
  autoWin?: number;
  semiAutoWin?: number;
  manualWin?: number;
}

export interface LottoResult {
  round: number;
  stores: LottoStoreInfo[];

  // 기존 구조 유지용(사용 안 해도 됨)
  autoWin: number;
  semiAutoWin: number;
  manualWin: number;
}

type WnShopItem = {
  shpNm?: string;
  shpAddr?: string;
  wnShpRnk?: number;
  atmtPsvYnTxt?: string; // ✅ 다시 사용
};

type WnShopResponse = {
  resultCode: string | null;
  resultMessage: string | null;
  data?: {
    total?: number;
    list?: WnShopItem[];
  };
};

const getWinnerShopAPI = (round: number, rank: 1 | 2) =>
  `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=${rank}&srchLtEpsd=${round}`;

function normalizeAddress(raw: string) {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // 1) 연속 중복 토큰 제거
  const tokens = s.split(" ");
  const out: string[] = [];
  for (const t of tokens) {
    if (out.length > 0 && out[out.length - 1] === t) continue;
    out.push(t);
  }

  // 2) 뒤쪽 반복 블록 제거 (A B A B / X X)
  for (let k = 1; k <= 4; k++) {
    if (out.length >= 2 * k) {
      const tail = out.slice(-k).join(" ");
      const prev = out.slice(-2 * k, -k).join(" ");
      if (tail === prev) {
        out.splice(out.length - k, k);
        break;
      }
    }
  }

  return out.join(" ").trim();
}

function applyStoreType(store: LottoStoreInfo, rank: 1 | 2, typeTxt?: string) {
  const t = (typeTxt ?? "").trim();

  // ----------------------------
  // ✅ 2등: 타입이 "있으면" 분리 저장,
  //        타입이 "없거나/인식불가"면 기존처럼 autoWin에 누적
  // ----------------------------
  if (rank === 2) {
    if (t) {
      // 타입 문자열이 제공되는 경우: 우선 분리 시도
      if (t.includes("반자동")) {
        store.semiAutoWin = (store.semiAutoWin ?? 0) + 1;
        return;
      }
      if (t.includes("수동")) {
        store.manualWin = (store.manualWin ?? 0) + 1;
        return;
      }
      if (t.includes("자동")) {
        store.autoWin = (store.autoWin ?? 0) + 1;
        return;
      }

      // ✅ 타입 문자열은 있는데 우리가 모르는 값이면 → 기존 호환을 위해 auto로 처리
      store.autoWin = (store.autoWin ?? 0) + 1;
      return;
    }

    // ✅ 타입 문자열 자체가 없으면(레거시) → 기존처럼 auto에 총합 누적
    store.autoWin = (store.autoWin ?? 0) + 1;
    return;
  }

  // ----------------------------
  // ✅ 1등: 기존 로직 유지 (분리 저장)
  // ----------------------------
  if (t.includes("반자동")) store.semiAutoWin = (store.semiAutoWin ?? 0) + 1;
  else if (t.includes("수동")) store.manualWin = (store.manualWin ?? 0) + 1;
  else if (t.includes("자동")) store.autoWin = (store.autoWin ?? 0) + 1;
  else {
    // 혹시 빈 값/예외 값이면 안전하게 자동로 처리
    store.autoWin = (store.autoWin ?? 0) + 1;
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 7000
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

async function fetchStoresByRank(
  round: number,
  rank: 1 | 2
): Promise<LottoStoreInfo[]> {
  const url = getWinnerShopAPI(round, rank);
  const json = await fetchJsonWithTimeout<WnShopResponse>(url);

  const list = json?.data?.list ?? [];
  const map = new Map<string, LottoStoreInfo>();

  for (const item of list) {
    const storeName = item.shpNm?.trim();
    const address = normalizeAddress(item.shpAddr ?? "");

    if (!storeName || !address) continue;

    const key = `${rank}|${storeName}|${address}`;
    if (!map.has(key)) {
      map.set(key, {
        rank,
        store: storeName,
        address,
        autoWin: 0,
        semiAutoWin: 0,
        manualWin: 0,
      });
    }

    // ✅ 업체 기준 타입 누적
    applyStoreType(map.get(key)!, rank, item.atmtPsvYnTxt);
  }

  return Array.from(map.values());
}

export async function fetchLottoStores(round: number): Promise<LottoResult> {
  try {
    const [first, second] = await Promise.all([
      fetchStoresByRank(round, 1),
      fetchStoresByRank(round, 2),
    ]);

    return {
      round,
      stores: [...first, ...second],
      autoWin: 0,
      semiAutoWin: 0,
      manualWin: 0,
    };
  } catch (err: any) {
    console.error(
      `❌ 회차 ${round} 판매점(JSON) 수집 실패:`,
      err?.message ?? err
    );
    return { round, stores: [], autoWin: 0, semiAutoWin: 0, manualWin: 0 };
  }
}
