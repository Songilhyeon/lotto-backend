import express from "express";
import { lottoStoreByRank } from "../lib/lottoCache";
import { LottoStore } from "../types/store";

const router = express.Router();

/**
 * GET /api/lotto/stores/history
 * query:
 *   - store: string (필수)
 *   - address: string (필수)
 *   - rank?: number (1 또는 2, 선택)
 *   - limit?: number (최근 N회, 기본 5)
 */
router.get("/", (req, res) => {
  try {
    const { store, address, rank, limit } = req.query;
    const limitNum = limit ? Number(limit) : 5;

    if (!store || !address) {
      return res.status(400).json({ error: "Store and address are required" });
    }

    const rankNum = rank ? Number(rank) : null;
    const ranksToFetch: (1 | 2)[] =
      rankNum && [1, 2].includes(rankNum) ? [rankNum as 1 | 2] : [1, 2];

    const result: Record<number, { totalCount: number; storeHistory: any[] }> =
      {};

    ranksToFetch.forEach((r) => {
      const storesForRank: LottoStore[] = lottoStoreByRank.get(r) || [];

      const matchedStores = storesForRank.filter(
        (s) => s.store === store && s.address === address
      );

      const storeHistory = matchedStores
        .sort((a, b) => b.drwNo - a.drwNo)
        .slice(0, limitNum)
        .map((s) => ({
          rank: r,
          drwNoDate: s.drwNoDate,
          round: s.drwNo,
          autoWin: s.autoWin ?? 0,
          semiAutoWin: s.semiAutoWin ?? 0,
          manualWin: s.manualWin ?? 0,
        }));

      result[r] = {
        totalCount: matchedStores.length,
        storeHistory,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error in /api/lotto/stores/history", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
