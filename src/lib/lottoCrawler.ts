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

    // --- 최신 권장 방식: User-Agent + Referer 설정 ---
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      Referer:
        "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645",
    });

    await page.goto(url, { waitUntil: "networkidle0" });

    // --- 접속 대기 팝업 처리 ---
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 1000 });
      console.log(`💡 회차 ${round}: 접속 대기 팝업 감지`);
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 300000 }
      );
      console.log(`✅ 회차 ${round}: 팝업 사라짐`);
    } catch {
      console.log(`💡 회차 ${round}: 팝업 없음`);
    }

    // --- 1등 배출점 테이블 로딩 대기 (최대 60초) ---
    await page.waitForFunction(
      () => {
        const table = Array.from(document.querySelectorAll("div.group_content"))
          .find(
            (div) =>
              div.querySelector("h4.title")?.textContent?.trim() ===
              "1등 배출점"
          )
          ?.querySelector("table.tbl_data.tbl_data_col");

        // tbody tr이 있으면 true, 없으면 false
        return table ? table?.querySelectorAll("tbody tr").length > 0 : false;
      },
      { timeout: 60000 }
    );

    // --- 1등 배출점 데이터 추출 ---
    const stores: LottoStoreInfo[] = await page.evaluate(() => {
      const table = Array.from(document.querySelectorAll("div.group_content"))
        .find(
          (div) =>
            div.querySelector("h4.title")?.textContent?.trim() === "1등 배출점"
        )
        ?.querySelector("table.tbl_data.tbl_data_col");

      if (!table) return []; // 1등 배출점이 없으면 빈 배열 반환

      return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
        const tds = tr.querySelectorAll("td");
        const typeText = tds[2]?.textContent?.trim() || "";

        return {
          rank: Number(tds[0]?.textContent?.trim() || 0),
          store: tds[1]?.textContent?.trim() || "",
          address: tds[3]?.textContent?.trim() || "",
          autoWin: typeText.includes("자동") ? 1 : 0,
          semiAutoWin: typeText.includes("반자동") ? 1 : 0,
          manualWin: typeText.includes("수동") ? 1 : 0,
        };
      });
    });

    const autoWin = stores.reduce((sum, s) => sum + (s.autoWin || 0), 0);
    const semiAutoWin = stores.reduce(
      (sum, s) => sum + (s.semiAutoWin || 0),
      0
    );
    const manualWin = stores.reduce((sum, s) => sum + (s.manualWin || 0), 0);

    await browser.close();

    return { round, stores, autoWin, semiAutoWin, manualWin };
  } catch (err) {
    console.error(`❌ 회차 ${round} 상위 판매점 데이터 수집 실패`, err);
    if (browser) await browser.close();
    return { round, stores: [], autoWin: 0, semiAutoWin: 0, manualWin: 0 };
  }
}
