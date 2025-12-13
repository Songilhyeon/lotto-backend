import express from "express";
import { lottoStoreCache, lottoStoreByRank } from "../lib/lottoCache";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // ----------------------------
    // 0) rank 쿼리 처리
    // ----------------------------
    const rankQuery = req.query.rank ? Number(req.query.rank) : undefined;

    if (rankQuery && ![1, 2].includes(rankQuery)) {
      return res.status(400).json({ error: "Invalid rank value" });
    }

    const filteredStores = rankQuery
      ? lottoStoreByRank.get(rankQuery) || []
      : lottoStoreCache;

    // ----------------------------
    // 1) 전국 통계
    // ----------------------------
    const nationwideStoreMap = new Map();
    const nationwideRegionMap = new Map();
    let nationwideAuto = 0,
      nationwideSemi = 0,
      nationwideManual = 0;

    for (const item of filteredStores) {
      // 전국 판매점 TOP
      const key = item.store + "|" + item.address;
      if (!nationwideStoreMap.has(key))
        nationwideStoreMap.set(key, {
          store: item.store,
          address: item.address,
          appearanceCount: 0, // 등장 횟수(판매점 기준 : 한 판매점이 당첨 판매점으로 등장한 횟수)
          autoWin: 0,
          semiAutoWin: 0,
          manualWin: 0,
        });
      const storeData = nationwideStoreMap.get(key)!;
      storeData.appearanceCount++;
      storeData.autoWin += item.autoWin ?? 0;
      storeData.semiAutoWin += item.semiAutoWin ?? 0;
      storeData.manualWin += item.manualWin ?? 0;

      // 전국 지역별 통계 (시/도)
      let region = item.address.split(" ")[0];
      if (region.includes("동행복권")) region = "인터넷";
      if (!nationwideRegionMap.has(region)) nationwideRegionMap.set(region, 0);
      nationwideRegionMap.set(region, nationwideRegionMap.get(region)! + 1);

      // 전국 자동/반자동/수동
      nationwideAuto += item.autoWin ?? 0;
      nationwideSemi += item.semiAutoWin ?? 0;
      nationwideManual += item.manualWin ?? 0;
    }

    const nationwide = {
      tops: [...nationwideStoreMap.values()]
        .sort((a, b) => b.appearanceCount - a.appearanceCount)
        .slice(0, 10),
      region: [...nationwideRegionMap.entries()].map(
        ([region, regionCount]) => ({
          region,
          regionCount, // 지역 / 구 단위 : 해당 지역에서 당첨 판매점이 나온 총 횟수
        })
      ),
      method: {
        auto: nationwideAuto,
        semi: nationwideSemi,
        manual: nationwideManual,
      },
    };

    // ----------------------------
    // 2) 시/도별 통계
    // ----------------------------
    const byRegion: Record<string, any> = {};

    for (const [region, regionCount] of nationwideRegionMap.entries()) {
      const storesInRegion = filteredStores.filter((item) => {
        let r = item.address.split(" ")[0];
        if (r.includes("동행복권")) r = "인터넷";
        return r === region;
      });

      const storeMapRegion = new Map();
      let autoR = 0,
        semiR = 0,
        manualR = 0;
      const subRegionMap: Map<string, number> = new Map();

      for (const item of storesInRegion) {
        const key = item.store + "|" + item.address;
        if (!storeMapRegion.has(key))
          storeMapRegion.set(key, {
            store: item.store,
            address: item.address,
            appearanceCount: 0,
            autoWin: 0,
            semiAutoWin: 0,
            manualWin: 0,
          });
        const storeData = storeMapRegion.get(key)!;
        storeData.appearanceCount++;
        storeData.autoWin += item.autoWin ?? 0;
        storeData.semiAutoWin += item.semiAutoWin ?? 0;
        storeData.manualWin += item.manualWin ?? 0;

        // 지역별 자동/반자동/수동 합계
        autoR += item.autoWin ?? 0;
        semiR += item.semiAutoWin ?? 0;
        manualR += item.manualWin ?? 0;

        // 구/군 단위 통계
        const parts = item.address.split(" ");
        const subRegion = parts[1] ?? "기타";
        const prevCount = subRegionMap.get(subRegion) ?? 0;
        subRegionMap.set(subRegion, prevCount + 1);
      }

      byRegion[region] = {
        tops: [...storeMapRegion.values()]
          .sort((a, b) => b.appearanceCount - a.appearanceCount)
          .slice(0, 10),
        method: { auto: autoR, semi: semiR, manual: manualR },
        region: [{ region, regionCount }],
        subRegionStats: [...subRegionMap.entries()].map(
          ([subRegion, regionCount]) => ({ subRegion, regionCount })
        ),
      };
    }

    // ----------------------------
    // 3) 응답
    // ----------------------------
    res.json({
      rank: rankQuery || "all",
      nationwide,
      byRegion,
    });
  } catch (err) {
    console.error("Error in /api/lotto/stores", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
