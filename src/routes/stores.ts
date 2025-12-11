import express from "express";
import { lottoStoreCache } from "../lib/lottoCache";

const router = express.Router();

/**
 * /api/stats/all
 * 모든 통계 데이터를 캐시 기반으로 반환
 */
router.get("/", async (req, res) => {
  try {
    // -----------------------------------------
    // 1) TOP 10 판매점
    // lottoStoreCache = [{ store, address, drwNo, rank, autoWin, ... }]
    // -----------------------------------------

    // 판매점별 그룹화
    const storeMap = new Map();

    for (const item of lottoStoreCache) {
      const key = item.store + "|" + item.address;

      if (!storeMap.has(key)) {
        storeMap.set(key, {
          store: item.store,
          address: item.address,
          count: 0,
        });
      }
      storeMap.get(key).count++;
    }

    const topStores = [...storeMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // -----------------------------------------
    // 2) 지역별 통계 (시/도 단위)
    // address = "서울 강남구 역삼동 ..."
    // -----------------------------------------
    const regionMap = new Map();

    console.log("lottoStoreCache length:", lottoStoreCache.length);
    for (const item of lottoStoreCache) {
      let region = item.address.split(" ")[0]; // 원래 지역 추출

      // 특수 케이스: 인터넷 구매
      if (region.includes("동행복권")) {
        region = "인터넷"; // 또는 "동행복권"
      }

      if (!regionMap.has(region)) {
        regionMap.set(region, 0);
      }
      regionMap.set(region, regionMap.get(region) + 1);
    }

    const region = [...regionMap.entries()].map(([region, count]) => ({
      region,
      count,
    }));
    // -----------------------------------------
    // 3) 자동 / 반자동 / 수동 비율
    // lottoNumberCache = [{ drwNo, autoWin, semiAutoWin, manualWin }]
    // -----------------------------------------

    let auto = 0;
    let semiAuto = 0;
    let manual = 0;

    for (const row of lottoStoreCache) {
      auto += row.autoWin ?? 0;
      semiAuto += row.semiAutoWin ?? 0;
      manual += row.manualWin ?? 0;
    }

    const method = { auto, semiAuto, manual };

    // -----------------------------------------
    // 최종 응답
    // -----------------------------------------
    res.json({
      tops: topStores,
      region,
      method,
    });
  } catch (err) {
    console.error("Error in /api/lotto/stores:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
