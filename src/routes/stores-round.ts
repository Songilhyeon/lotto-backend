import express from "express";
import { lottoStoreByRank, lottoStoreCache } from "../lib/lottoCache";
import { LottoStore } from "../types/store";

const router = express.Router();

/**
 * GET /api/lotto/stores/round
 * query:
 *   - round: number (필수)
 */
router.get("/", (req, res) => {
  try {
    const roundQuery = req.query.round ? Number(req.query.round) : null;

    if (!roundQuery || isNaN(roundQuery)) {
      return res.status(400).json({ error: "Invalid round value" });
    }

    // ----------------------------
    // 1등, 2등 모두 필터링
    // ----------------------------
    const result: Record<string, LottoStore[]> = {};

    for (const rank of [1, 2]) {
      const storesForRank = lottoStoreByRank.get(rank) || [];
      result[rank] = storesForRank.filter((item) => item.drwNo === roundQuery);
    }

    // ----------------------------
    // 2) 응답
    // ----------------------------
    res.json(result);
  } catch (err) {
    console.error("Error in /api/lotto/stores/round", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
