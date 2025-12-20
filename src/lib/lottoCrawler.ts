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
    // browser = await puppeteer.launch({ headless: true });
    browser = await puppeteer.launch({
      headless: true, // "new" 대신 true 사용
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

    // await page.goto(url, { waitUntil: "networkidle0" });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 팝업 처리
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 1000 });
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 300000 }
      );
    } catch {
      // 팝업 없으면 무시
    }

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
        const rank = 1;
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

    // --- 2등 크롤링 (안정적 페이지 이동 + 누적) ---
    const secondPrizeStoresMap: Record<string, LottoStoreInfo> = {};
    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
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
          return { rank: 2, store, address, autoWin: 1 };
        });
      });

      // 중복 업체 autoWin 누적
      for (const store of storesOnPage) {
        const key = store.store + "|" + store.address;
        if (secondPrizeStoresMap[key]) {
          secondPrizeStoresMap[key].autoWin! += 1;
        } else {
          secondPrizeStoresMap[key] = store;
        }
      }

      // 다음 페이지 존재 여부 확인
      hasNextPage = await page.evaluate((pageNum) => {
        const pageBox = document.getElementById("page_box");
        if (!pageBox) return false;

        const nextLink = Array.from(pageBox.querySelectorAll("a")).find((a) =>
          a.getAttribute("onclick")?.includes(`selfSubmit(${pageNum + 1})`)
        );

        if (nextLink) {
          (nextLink as HTMLElement).click();
          return true;
        }
        return false;
      }, currentPage);

      if (hasNextPage) {
        currentPage++;

        // ⭐ 핵심: 페이지 이동 후 테이블 다시 등장할 때까지 대기
        await page.waitForFunction(
          () => {
            const title = Array.from(
              document.querySelectorAll("div.group_content h4.title")
            ).find((el) => el.textContent?.trim() === "2등 배출점");

            return !!title;
          },
          { timeout: 10000 }
        );
      }
    }

    await browser.close();

    const allStores = [
      ...firstPrizeStores,
      ...Object.values(secondPrizeStoresMap),
    ];

    // 1등 기준 전체 합
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
