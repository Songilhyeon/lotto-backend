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
    const storeHistory = storesForRank
      .filter((s) => s.store === store && s.address === address)
      .sort((a, b) => b.drwNo - a.drwNo) // 최신 회차부터
      .slice(0, limitNum)
      .map((s) => ({
        round: s.drwNo,
        autoWin: s.autoWin ?? 0,
        semiAutoWin: s.semiAutoWin ?? 0,
        manualWin: s.manualWin ?? 0,
      }));

    res.json(storeHistory);
  } catch (err) {
    console.error("Error in /api/lotto/stores/history", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
