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
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      Referer:
        "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645",
    });

    await page.goto(url, { waitUntil: "networkidle0" });

    // 팝업 처리
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 1000 });
      console.log(`💡 회차 ${round}: 팝업 감지`);
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 300000 }
      );
      console.log(`✅ 회차 ${round}: 팝업 사라짐`);
    } catch {
      console.log(`💡 회차 ${round}: 팝업 없음`);
    }

    // 1등 테이블 로딩 대기
    await page.waitForFunction(
      () => {
        const table = Array.from(document.querySelectorAll("div.group_content"))
          .find(
            (div) =>
              div.querySelector("h4.title")?.textContent?.trim() ===
              "1등 배출점"
          )
          ?.querySelector("table.tbl_data.tbl_data_col");
        return table ? table.querySelectorAll("tbody tr").length > 0 : false;
      },
      { timeout: 60000 }
    );

    // --- 1등 크롤링 ---
    const firstPrizeStores: LottoStoreInfo[] = await page.evaluate(() => {
      const table = Array.from(document.querySelectorAll("div.group_content"))
        .find(
          (div) =>
            div.querySelector("h4.title")?.textContent?.trim() === "1등 배출점"
        )
        ?.querySelector("table.tbl_data.tbl_data_col");
      if (!table) return [];

      const storeMap: Record<string, LottoStoreInfo> = {};

      Array.from(table.querySelectorAll("tbody tr")).forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        const rank = 1; // 1등 고정
        const store = tds[1]?.textContent?.trim() || "";
        const address = tds[3]?.textContent?.trim() || "";
        const typeText = tds[2]?.textContent?.trim() || "";

        const auto = typeText.includes("자동") ? 1 : 0;
        const semi = typeText.includes("반자동") ? 1 : 0;
        const manual = typeText.includes("수동") ? 1 : 0;

        const key = store + "|" + address;
        if (!storeMap[key]) {
          storeMap[key] = {
            rank,
            store,
            address,
            autoWin: 0,
            semiAutoWin: 0,
            manualWin: 0,
          };
        }
        storeMap[key].autoWin! += auto;
        storeMap[key].semiAutoWin! += semi;
        storeMap[key].manualWin! += manual;
      });

      return Object.values(storeMap);
    });

    // --- 2등 크롤링 (페이지네이션 처리) ---
    const secondPrizeStores: LottoStoreInfo[] = [];
    const maxPages = await page.evaluate(() => {
      const pageBox = document.querySelector("div.paginate_common");
      if (!pageBox) return 1;
      const pages = Array.from(pageBox.querySelectorAll("a"))
        .map((a) => Number(a.textContent?.trim()))
        .filter((n) => !isNaN(n));
      return pages.length > 0 ? Math.max(...pages) : 1;
    });

    for (let p = 1; p <= maxPages; p++) {
      if (p > 1) {
        await page.evaluate((pageNum) => {
          // @ts-ignore
          selfSubmit(pageNum);
        }, p);
        // 페이지 로딩 대기
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const storesOnPage: LottoStoreInfo[] = await page.evaluate(() => {
        const table = Array.from(document.querySelectorAll("div.group_content"))
          .find(
            (div) =>
              div.querySelector("h4.title")?.textContent?.trim() ===
              "2등 배출점"
          )
          ?.querySelector("table.tbl_data.tbl_data_col");

        if (!table) return [];

        return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
          const tds = tr.querySelectorAll("td");
          const store = tds[1]?.textContent?.trim() || "";
          const address = tds[2]?.textContent?.trim() || "";
          return { rank: 2, store, address };
        });
      });

      secondPrizeStores.push(...storesOnPage);
    }

    await browser.close();

    const allStores = [...firstPrizeStores, ...secondPrizeStores];

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

    return { round, stores: allStores, autoWin, semiAutoWin, manualWin };
  } catch (err) {
    console.error(`❌ 회차 ${round} 상위 판매점 데이터 수집 실패`, err);
    if (browser) await browser.close();
    return { round, stores: [], autoWin: 0, semiAutoWin: 0, manualWin: 0 };
  }
}
