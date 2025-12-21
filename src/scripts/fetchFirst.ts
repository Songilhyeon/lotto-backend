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
            "--allow-running-insecure-content",
            "--disable-blink-features=AutomationControlled",
            // 🔥 User-Agent를 launch 시점에 설정
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ]
        : [],
    });

    console.log(`[INFO][${round}] Browser launched successfully`);

    const page = await browser.newPage();

    // 🔥 순서 중요: Viewport → User-Agent → Headers → goto

    // 1. Viewport 먼저 설정
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // 2. 자동화 감지 우회
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });

      (window as any).chrome = {
        runtime: {},
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);
    });

    // 3. User-Agent 설정
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36"
    );

    // 4. Headers 설정
    await page.setExtraHTTPHeaders({
      Referer: "https://www.dhlottery.co.kr/",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    console.log(`[INFO][${round}] Navigating to ${url}`);

    // 5. 이제 페이지 이동
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const currentUrl = page.url();
    console.log(`[INFO][${round}] Page loaded, URL: ${currentUrl}`);

    // 🔥 모바일 리다이렉트 확인
    if (currentUrl.includes("m.dhlottery")) {
      console.log(
        `[ERROR][${round}] Still redirected to mobile! Attempting desktop URL...`
      );

      // 데스크톱 URL로 강제 이동
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      console.log(`[INFO][${round}] Retry URL: ${page.url()}`);
    }

    await new Promise((r) => setTimeout(r, 3000));

    // 접속 대기 팝업 처리
    try {
      await page.waitForSelector("div.popup.conn_wait_pop", { timeout: 2000 });
      console.log(`[INFO][${round}] 접속 대기 팝업 감지`);
      await page.waitForFunction(
        () => !document.querySelector("div.popup.conn_wait_pop"),
        { timeout: 30000 }
      );
    } catch {
      console.log(`[INFO][${round}] 접속 대기 팝업 없음`);
    }

    // h4.title 대기
    try {
      await page.waitForFunction(
        () => document.querySelectorAll("h4.title").length > 0,
        { timeout: 20000 }
      );
      console.log(`[INFO][${round}] Content rendered`);
    } catch (err) {
      console.log(`[WARN][${round}] h4.title not found after 20s`);

      const finalUrl = page.url();
      console.log(`[DEBUG][${round}] Final URL:`, finalUrl);

      if (finalUrl.includes("m.dhlottery")) {
        console.log(
          `[ERROR][${round}] Mobile redirect persists! Cannot scrape.`
        );
      }
    }

    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h4.title")).map((el) =>
        el.textContent?.replace(/\s+/g, " ").trim()
      )
    );
    console.log(`[DEBUG][${round}] titles:`, titles);

    if (titles.length === 0) {
      console.log(`[WARN][${round}] No titles found`);
      return {
        round,
        stores: [],
        autoWin: 0,
        semiAutoWin: 0,
        manualWin: 0,
      };
    }

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

    console.log(`[INFO][${round}] Found ${firstPrizeStores.length} stores`);

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
