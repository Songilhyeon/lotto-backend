import puppeteer from "puppeteer";

export interface LottoStoreInfo {
  rank: number; // 2등이면 항상 2
  store: string;
  address: string;
  autoWin?: number; // 중복 개수 누적
  semiAutoWin?: number;
  manualWin?: number;
}

export async function fetchLottoStores(
  round: number
): Promise<LottoStoreInfo[]> {
  let browser;
  try {
    const url = `https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${round}`;

    browser = await puppeteer.launch({
      headless: true, // "new" 대신 true 사용
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // User-Agent + Referer
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      Referer:
        "https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645",
    });

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 2등 배출점 누적용 Map
    const storesMap: Record<string, LottoStoreInfo> = {};

    // 페이지네이션 확인
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

        await new Promise((resolve) => setTimeout(resolve, 500)); // 페이지 로딩 대기
      }

      // 페이지 내 2등 테이블 가져오기 (속도 최적화)
      const pageStores: LottoStoreInfo[] = await page.$$eval(
        "div.group_content",
        (groups) => {
          const results: LottoStoreInfo[] = [];
          groups.forEach((group) => {
            const title = group.querySelector("h4.title")?.textContent?.trim();
            if (title === "2등 배출점") {
              const table = group.querySelector("table.tbl_data");
              if (!table) return;
              Array.from(table.querySelectorAll("tbody tr")).forEach((tr) => {
                const tds = tr.querySelectorAll("td");
                if (tds.length < 3) return;
                results.push({
                  rank: 2,
                  store: tds[1]?.textContent?.trim() || "",
                  address: tds[2]?.textContent?.trim() || "",
                  autoWin: 1, // 한 페이지 당 1개씩
                });
              });
            }
          });
          return results;
        }
      );

      // 중복 누적
      for (const store of pageStores) {
        const key = store.store + "|" + store.address;
        if (storesMap[key]) {
          storesMap[key].autoWin! += 1;
        } else {
          storesMap[key] = store;
        }
      }
    }

    await browser.close();
    return Object.values(storesMap);
  } catch (err) {
    console.error(`❌ 회차 ${round} 2등 배출점 데이터 수집 실패`, err);
    if (browser) await browser.close();
    return [];
  }
}
