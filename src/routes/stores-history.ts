import express from "express";
import { lottoStoreByRank } from "../lib/lottoCache";
import { LottoStore } from "../types/store";

const router = express.Router();

/**
 * GET /api/lotto/stores/history
 * query:
 *   - store: string (필수)
 *   - address: string (필수)
 *   - rank: number (1 또는 2, 필수)
 *   - limit: number (최근 N회, 선택, 기본 5)
 */
router.get("/", (req, res) => {
  try {
    const { store, address, rank, limit } = req.query;
    const rankNum = rank ? Number(rank) : null;
    const limitNum = limit ? Number(limit) : 5;

    if (!store || !address || !rankNum || ![1, 2].includes(rankNum)) {
      return res.status(400).json({ error: "Invalid query parameters" });
    }

    const storesForRank: LottoStore[] = lottoStoreByRank.get(rankNum) || [];

    // ✅ 1. 먼저 필터링 결과를 변수로 저장
    const matchedStores = storesForRank.filter(
      (s) => s.store === store && s.address === address
    );

    // ✅ 2. 전체 등장 횟수
    const totalCount = matchedStores.length;

    // ✅ 3. 최근 N회 데이터
    const storeHistory = matchedStores
      .sort((a, b) => b.drwNo - a.drwNo)
      .slice(0, limitNum)
      .map((s) => ({
        round: s.drwNo,
        autoWin: s.autoWin ?? 0,
        semiAutoWin: s.semiAutoWin ?? 0,
        manualWin: s.manualWin ?? 0,
      }));

    // ✅ 4. 함께 리턴
    res.json({
      totalCount,
      storeHistory,
    });
  } catch (err) {
    console.error("Error in /api/lotto/stores/history", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
