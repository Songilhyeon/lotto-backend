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
        : [],
    });

    console.log(`[INFO][${round}] Browser launched successfully`);

    const page = await browser.newPage();

    // 🔥 핵심: Request Interception으로 모바일 리다이렉트 차단
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

    console.log(`[INFO][${round}] Navigating to ${url}`);

    // 페이지 이동
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const currentUrl = page.url();
    console.log(`[INFO][${round}] Page loaded, URL: ${currentUrl}`);

    // 리다이렉트 체크
    if (currentUrl.includes("m.dhlottery")) {
      console.log(
        `[ERROR][${round}] Mobile redirect occurred despite blocking!`
      );
      return {
        round,
        stores: [],
        autoWin: 0,
        semiAutoWin: 0,
        manualWin: 0,
      };
    }

    // 충분한 대기 시간
    console.log(`[INFO][${round}] Waiting for content to render...`);
    await new Promise((r) => setTimeout(r, 5000));

    // 접속 대기 팝업 처리
    try {
      const popupExists = await page.evaluate(() => {
        return !!document.querySelector("div.popup.conn_wait_pop");
      });

      if (popupExists) {
        console.log(`[INFO][${round}] 접속 대기 팝업 감지, 대기 중...`);
        await page.waitForFunction(
          () => !document.querySelector("div.popup.conn_wait_pop"),
          { timeout: 30000 }
        );
        console.log(`[INFO][${round}] 팝업 사라짐`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.log(`[INFO][${round}] 팝업 처리 중 타임아웃 또는 없음`);
    }

    // h4.title 확인
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h4.title")).map((el) =>
        el.textContent?.replace(/\s+/g, " ").trim()
      )
    );

    console.log(`[DEBUG][${round}] titles:`, titles);

    if (titles.length === 0) {
      console.log(`[WARN][${round}] No titles found, checking page content...`);

      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(
        `[DEBUG][${round}] Body preview:`,
        bodyText.substring(0, 300)
      );

      // HTML 저장 (디버깅용)
      if (isProd) {
        const html = await page.content();
        const fs = require("fs");
        fs.writeFileSync(`/tmp/lotto-${round}.html`, html);
        console.log(`[DEBUG][${round}] HTML saved to /tmp/lotto-${round}.html`);
      }

      return {
        round,
        stores: [],
        autoWin: 0,
        semiAutoWin: 0,
        manualWin: 0,
      };
    }

    // 데이터 추출
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

    console.log(
      `[SUCCESS][${round}] Found ${firstPrizeStores.length} stores (자동: ${autoWin}, 반자동: ${semiAutoWin}, 수동: ${manualWin})`
    );

    return {
      round,
      stores: firstPrizeStores,
      autoWin,
      semiAutoWin,
      manualWin,
    };
  } catch (err: any) {
    console.error(`❌ 회차 ${round} 실패:`, err.message);
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
