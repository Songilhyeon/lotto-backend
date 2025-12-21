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

    const findChromiumPath = () => {
      const paths = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",
      ];
      const fs = require("fs");
      for (const path of paths) {
        if (fs.existsSync(path)) return path;
      }
      return undefined;
    };

    browser = await puppeteer.launch({
      headless: true,
      executablePath: isProd ? findChromiumPath() : undefined,
      args: isProd
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1920,1080",
          ]
        : ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    console.log(`[INFO][${round}] Browser launched successfully (1+2등)`);

    const page = await browser.newPage();

    // 🔥 Request Interception으로 모바일 리다이렉트 차단
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const requestUrl = request.url();

      // 모바일 사이트로 가는 요청 차단
      if (requestUrl.includes("m.dhlottery.co.kr")) {
        console.log(`[BLOCK] Mobile redirect blocked: ${requestUrl}`);
        request.abort();
        return;
      }

      // 불필요한 리소스 차단 (속도 향상)
      if (
        ["image", "stylesheet", "font", "media"].includes(
          request.resourceType()
        )
      ) {
        request.abort();
        return;
      }

      request.continue();
    });

    // Viewport 설정
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // 자동화 감지 우회
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });

      Object.defineProperty(navigator, "platform", {
        get: () => "Win32",
      });

      Object.defineProperty(navigator, "vendor", {
        get: () => "Google Inc.",
      });

      (window as any).chrome = {
        runtime: {},
      };
    });

    // User-Agent 설정
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36"
    );

    // Headers 설정
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    console.log(`[INFO][${round}] Navigating to ${url} (1+2등)`);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const currentUrl = page.url();
    console.log(`[INFO][${round}] Page loaded, URL: ${currentUrl} (1+2등)`);

    // 리다이렉트 체크
    if (currentUrl.includes("m.dhlottery")) {
      console.log(`[ERROR][${round}] Mobile redirect occurred! (1+2등)`);
      return { round, stores: [], autoWin: 0, semiAutoWin: 0, manualWin: 0 };
    }

    // 충분한 대기 시간
    console.log(`[INFO][${round}] Waiting for content to render... (1+2등)`);
    await new Promise((r) => setTimeout(r, 5000));

    // 접속 대기 팝업 처리
    try {
      const popupExists = await page.evaluate(() => {
        return !!document.querySelector("div.popup.conn_wait_pop");
      });

      if (popupExists) {
        console.log(`[INFO][${round}] 접속 대기 팝업 감지 (1+2등)`);
        await page.waitForFunction(
          () => !document.querySelector("div.popup.conn_wait_pop"),
          { timeout: 30000 }
        );
        console.log(`[INFO][${round}] 팝업 사라짐 (1+2등)`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.log(`[INFO][${round}] 팝업 처리 중 타임아웃 또는 없음 (1+2등)`);
    }

    // --- 1등 크롤링 ---
    console.log(`[INFO][${round}] Crawling 1등...`);

    const firstPrizeStores: LottoStoreInfo[] = await page.evaluate(() => {
      const group = Array.from(
        document.querySelectorAll("div.group_content")
      ).find((div) => {
        const title = div.querySelector("h4.title")?.textContent?.trim() ?? "";
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

    console.log(`[INFO][${round}] Found ${firstPrizeStores.length} 1등 stores`);

    // --- 2등 크롤링 (페이지네이션) ---
    console.log(`[INFO][${round}] Crawling 2등...`);

    const secondPrizeStoresMap: Record<string, LottoStoreInfo> = {};
    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      console.log(`[INFO][${round}] Processing 2등 page ${currentPage}`);

      const storesOnPage: LottoStoreInfo[] = await page.evaluate(() => {
        const group = Array.from(
          document.querySelectorAll("div.group_content")
        ).find((div) => {
          const title =
            div.querySelector("h4.title")?.textContent?.trim() ?? "";
          return title.includes("2등");
        });

        if (!group) return [];

        const table = group.querySelector("table.tbl_data.tbl_data_col");
        if (!table) return [];

        return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
          const tds = tr.querySelectorAll("td");
          const store = tds[1]?.textContent?.trim() || "";
          const address = tds[2]?.textContent?.trim() || "";
          return { rank: 2, store, address, autoWin: 1 };
        });
      });

      console.log(
        `[INFO][${round}] Page ${currentPage} found ${storesOnPage.length} 2등 stores`
      );

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

        // 페이지 이동 후 테이블 다시 등장할 때까지 대기
        try {
          await page.waitForFunction(
            () => {
              const title = Array.from(
                document.querySelectorAll("div.group_content h4.title")
              ).find((el) => el.textContent?.trim()?.includes("2등"));
              return !!title;
            },
            { timeout: 15000 }
          );

          // 추가 안정성 대기
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          console.log(
            `[WARN][${round}] Timeout waiting for page ${currentPage}, breaking loop`
          );
          hasNextPage = false;
        }
      }
    }

    const totalSecondStores = Object.values(secondPrizeStoresMap).length;
    console.log(`[INFO][${round}] Total 2등 stores: ${totalSecondStores}`);

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

    console.log(
      `[SUCCESS][${round}] Total stores: ${allStores.length} (1등: ${firstPrizeStores.length}, 2등: ${totalSecondStores})`
    );

    return { round, stores: allStores, autoWin, semiAutoWin, manualWin };
  } catch (err: any) {
    console.error(
      `❌ 회차 ${round} 상위 판매점 데이터 수집 실패:`,
      err.message
    );
    return { round, stores: [], autoWin: 0, semiAutoWin: 0, manualWin: 0 };
  } finally {
    if (browser) await browser.close();
  }
}
