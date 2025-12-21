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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      Referer:
        "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // ⏳ 서버 환경 안정용 딜레이
    await new Promise((r) => setTimeout(r, 1500));

    // ⏳ 접속 대기 팝업 있으면 제거
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 1000 });
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 10000 }
      );
    } catch {
      /* popup 없으면 무시 */
    }

    // 🔎 DEBUG: EC2 DOM 확인용 (문제 해결 후 지워도 됨)
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h4.title")).map((el) =>
        el.textContent?.replace(/\s+/g, " ").trim()
      )
    );
    console.log(`[DEBUG][${round}] titles:`, titles);

    const firstPrizeStores: LottoStoreInfo[] = await page.evaluate(() => {
      const group = Array.from(
        document.querySelectorAll("div.group_content")
      ).find((div) => {
        const title =
          div
            .querySelector("h4.title")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ?? "";
        return title.includes("1등");
      });

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

    const autoWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.autoWin ?? 0),
      0
    );
    const semiAutoWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.semiAutoWin ?? 0),
      0
    );
    const manualWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.manualWin ?? 0),
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
