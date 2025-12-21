import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";

export interface LottoStoreInfo {
  rank: number;
  store: string;
  address: string;
  autoWin?: number;
  semiAutoWin?: number;
  manualWin?: number;
}

export interface LottoResult {
  round: number;
  stores: LottoStoreInfo[];
  autoWin: number;
  semiAutoWin: number;
  manualWin: number;
}

export async function fetchLottoStores(round: number): Promise<LottoResult> {
  let browser: Browser | null = null;

  try {
    const url = `https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${round}`;

    const isProd = process.env.NODE_ENV === "production";

    browser = await puppeteer.launch({
      headless: true,
      args: isProd
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
          ]
        : [],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      Referer:
        "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645",
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 1500));

    // 팝업 있으면 대기
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 1000 });
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 10000 }
      );
    } catch {}

    const firstPrizeStores: LottoStoreInfo[] = await page.evaluate(() => {
      const group = Array.from(
        document.querySelectorAll("div.group_content")
      ).find(
        (div) =>
          div.querySelector("h4.title")?.textContent?.trim() === "1등 배출점"
      );

      if (!group) return [];

      const table = group.querySelector("table.tbl_data.tbl_data_col");
      if (!table) return [];

      const storeMap: Record<string, LottoStoreInfo> = {};

      Array.from(table.querySelectorAll("tbody tr")).forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 4) return;

        const store = tds[1]?.textContent?.trim();
        const typeText = tds[2]?.textContent?.trim() ?? "";
        const address = tds[3]?.textContent?.trim();

        if (!store || !address) return;

        const key = `${store}|${address}`;

        if (!storeMap[key]) {
          storeMap[key] = {
            rank: 1,
            store,
            address,
            autoWin: 0,
            semiAutoWin: 0,
            manualWin: 0,
          };
        }

        if (typeText.includes("자동")) storeMap[key].autoWin!++;
        if (typeText.includes("반자동")) storeMap[key].semiAutoWin!++;
        if (typeText.includes("수동")) storeMap[key].manualWin!++;
      });

      return Object.values(storeMap);
    });

    const autoWin = firstPrizeStores.reduce((s, v) => s + (v.autoWin ?? 0), 0);
    const semiAutoWin = firstPrizeStores.reduce(
      (s, v) => s + (v.semiAutoWin ?? 0),
      0
    );
    const manualWin = firstPrizeStores.reduce(
      (s, v) => s + (v.manualWin ?? 0),
      0
    );

    return {
      round,
      stores: firstPrizeStores,
      autoWin,
      semiAutoWin,
      manualWin,
    };
  } catch (err) {
    console.error(`❌ 회차 ${round} 1등 판매점 수집 실패`, err);
    return {
      round,
      stores: [],
      autoWin: 0,
      semiAutoWin: 0,
      manualWin: 0,
    };
  } finally {
    if (browser) await browser.close();
  }
}
