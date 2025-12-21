import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";

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

    console.log(`[INFO][${round}] Browser launched successfully (2등)`);

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

    console.log(`[INFO][${round}] Navigating to ${url} (2등)`);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const currentUrl = page.url();
    console.log(`[INFO][${round}] Page loaded, URL: ${currentUrl} (2등)`);

    // 리다이렉트 체크
    if (currentUrl.includes("m.dhlottery")) {
      console.log(`[ERROR][${round}] Mobile redirect occurred! (2등)`);
      return [];
    }

    // 충분한 대기 시간
    console.log(`[INFO][${round}] Waiting for content to render... (2등)`);
    await new Promise((r) => setTimeout(r, 5000));

    // 접속 대기 팝업 처리
    try {
      const popupExists = await page.evaluate(() => {
        return !!document.querySelector("div.popup.conn_wait_pop");
      });

      if (popupExists) {
        console.log(`[INFO][${round}] 접속 대기 팝업 감지 (2등)`);
        await page.waitForFunction(
          () => !document.querySelector("div.popup.conn_wait_pop"),
          { timeout: 30000 }
        );
        console.log(`[INFO][${round}] 팝업 사라짐 (2등)`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.log(`[INFO][${round}] 팝업 처리 중 타임아웃 또는 없음 (2등)`);
    }

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

    console.log(`[INFO][${round}] 2등 페이지 수: ${maxPages}`);

    for (let p = 1; p <= maxPages; p++) {
      console.log(`[INFO][${round}] Processing page ${p}/${maxPages} (2등)`);

      if (p > 1) {
        await page.evaluate((pageNum) => {
          // @ts-ignore
          selfSubmit(pageNum);
        }, p);

        await new Promise((resolve) => setTimeout(resolve, 2000)); // 대기 시간 증가
      }

      // 페이지 내 2등 테이블 가져오기
      const pageStores: LottoStoreInfo[] = await page.evaluate(() => {
        const results: LottoStoreInfo[] = [];
        const groups = document.querySelectorAll("div.group_content");

        groups.forEach((group) => {
          const title = group.querySelector("h4.title")?.textContent?.trim();
          if (title?.includes("2등")) {
            const table = group.querySelector("table.tbl_data");
            if (!table) return;

            Array.from(table.querySelectorAll("tbody tr")).forEach((tr) => {
              const tds = tr.querySelectorAll("td");
              if (tds.length < 3) return;

              const store = tds[1]?.textContent?.trim() || "";
              const address = tds[2]?.textContent?.trim() || "";

              if (store && address) {
                results.push({
                  rank: 2,
                  store,
                  address,
                  autoWin: 1, // 한 페이지 당 1개씩
                });
              }
            });
          }
        });

        return results;
      });

      console.log(
        `[INFO][${round}] Page ${p} found ${pageStores.length} stores (2등)`
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

    const totalStores = Object.values(storesMap);
    console.log(`[SUCCESS][${round}] Total 2등 stores: ${totalStores.length}`);

    return totalStores;
  } catch (err: any) {
    console.error(`❌ 회차 ${round} 2등 배출점 데이터 수집 실패:`, err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
