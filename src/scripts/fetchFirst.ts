import puppeteer from "puppeteer";

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
  let browser;

  try {
    const url = `https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${round}`;

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
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
    });

    await page.goto(url, {
      waitUntil: "networkidle2", // ⭐ 핵심
      timeout: 60000,
    });

    // ⏳ 봇 탐지 완화용 짧은 딜레이
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 팝업 처리 (있을 때만)
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", {
        timeout: 1000,
      });
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 10000 }
      );
    } catch {
      /* noop */
    }

    // --- 1등 크롤링 (기다리지 않고 바로) ---
    const firstPrizeStores: LottoStoreInfo[] = await page.evaluate(() => {
      const groupContents = Array.from(
        document.querySelectorAll("div.group_content")
      );

      const firstGroup = groupContents.find(
        (div) =>
          div.querySelector("h4.title")?.textContent?.trim() === "1등 배출점"
      );

      if (!firstGroup) return [];

      const table = firstGroup.querySelector("table.tbl_data.tbl_data_col");
      if (!table) return [];

      const storeMap: Record<string, LottoStoreInfo> = {};

      Array.from(table.querySelectorAll("tbody tr")).forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 4) return;

        const store = tds[1]?.textContent?.trim() || "";
        const address = tds[3]?.textContent?.trim() || "";
        const typeText = tds[2]?.textContent?.trim() || "";

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

        if (typeText.includes("자동")) storeMap[key].autoWin! += 1;
        if (typeText.includes("반자동")) storeMap[key].semiAutoWin! += 1;
        if (typeText.includes("수동")) storeMap[key].manualWin! += 1;
      });

      return Object.values(storeMap);
    });

    await browser.close();

    const autoWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.autoWin || 0),
      0
    );
    const semiAutoWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.semiAutoWin || 0),
      0
    );
    const manualWin = firstPrizeStores.reduce(
      (sum, s) => sum + (s.manualWin || 0),
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
    if (browser) await browser.close();

    return {
      round,
      stores: [],
      autoWin: 0,
      semiAutoWin: 0,
      manualWin: 0,
    };
  }
}
