import express from "express";
import { lottoStoreByRank, lottoStoreCache } from "../lib/lottoCache";
import { LottoStore } from "../types/store";

const router = express.Router();

/**
 * 업체 단위 그룹핑 결과 타입
 */
interface GroupedStore {
  store: string;
  address: string;
  region: string;
  wins: {
    drwNo: number;
    rank: number;
  }[];
  totalWins: number;
  firstWinDrwNo: number;
  lastWinDrwNo: number;
}

router.get("/", (req, res) => {
  try {
    const rank = req.query.rank ? Number(req.query.rank) : undefined;
    const region = req.query.region as string | undefined;
    const q = req.query.q as string | undefined;

    const sortKey = (req.query.sortKey as string) || "latestRound";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // ----------------------------
    // 1️⃣ 기준 데이터 선택 (캐시)
    // ----------------------------
    let source: LottoStore[] = rank
      ? lottoStoreByRank.get(rank) || []
      : lottoStoreCache;

    // ----------------------------
    // 2️⃣ 지역 목록 추출 (rank 기준)
    // ----------------------------
    const regionSet = new Set<string>();

    for (const item of source) {
      let r = item.address.split(" ")[0];
      if (r.includes("동행복권")) r = "인터넷";
      regionSet.add(r);
    }

    const regions = Array.from(regionSet).sort((a, b) =>
      a.localeCompare(b, "ko")
    );

    // ----------------------------
    // 3️⃣ 지역 필터
    // ----------------------------
    if (region && region !== "전국") {
      source = source.filter((item) => {
        let r = item.address.split(" ")[0];
        if (r.includes("동행복권")) r = "인터넷";
        return r === region;
      });
    }

    // ----------------------------
    // 4️⃣ 검색 (업체명 / 주소)
    // ----------------------------
    if (q) {
      const keyword = q.trim();
      source = source.filter(
        (item) =>
          item.store?.includes(keyword) || item.address?.includes(keyword)
      );
    }

    // ----------------------------
    // 5️⃣ 업체 단위 그룹핑
    // ----------------------------
    const groupedMap = new Map<string, GroupedStore>();

    for (const item of source) {
      const key = `${item.store}|${item.address}`;

      let r = item.address.split(" ")[0];
      if (r.includes("동행복권")) r = "인터넷";

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          store: item.store,
          address: item.address,
          region: r,
          wins: [],
          totalWins: 0,
          firstWinDrwNo: item.drwNo,
          lastWinDrwNo: item.drwNo,
        });
      }

      const group = groupedMap.get(key)!;

      group.wins.push({
        drwNo: item.drwNo,
        rank: item.rank,
      });

      group.totalWins += 1;
      group.firstWinDrwNo = Math.min(group.firstWinDrwNo, item.drwNo);
      group.lastWinDrwNo = Math.max(group.lastWinDrwNo, item.drwNo);
    }

    // ----------------------------
    // 6️⃣ 정렬 (핵심)
    // ----------------------------
    const groupedStores = Array.from(groupedMap.values());

    groupedStores.sort((a, b) => {
      let result = 0;

      switch (sortKey) {
        case "name":
          result = a.store.localeCompare(b.store, "ko");
          break;

        case "winCount":
          result = a.totalWins - b.totalWins;
          break;

        case "firstRound":
          result = a.firstWinDrwNo - b.firstWinDrwNo;
          break;

        case "latestRound":
        default:
          result = a.lastWinDrwNo - b.lastWinDrwNo;
          break;
      }

      return sortOrder === "asc" ? result : -result;
    });

    // ----------------------------
    // 7️⃣ 페이지네이션
    // ----------------------------
    const total = groupedStores.length;
    const stores = groupedStores.slice(offset, offset + limit);

    // ----------------------------
    // 8️⃣ 응답
    // ----------------------------
    res.json({
      total,
      page,
      limit,
      regions,
      stores,
    });
  } catch (err) {
    console.error("Error in /api/lotto/stores/all", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
