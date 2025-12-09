// controllers/aiRecommendController.ts
import { Request, Response } from "express";
import { getAiRecommendation } from "../lib/aiRecommender";

export async function getAiRecommendationController(
  req: Request,
  res: Response
) {
  try {
    const roundParam = req.query.round;
    const clusterUnitParam = req.query.clusterUnit;

    if (!roundParam) {
      return res.status(400).json({ ok: false, error: "round query required" });
    }

    const round = Number(roundParam);
    const clusterUnit = clusterUnitParam ? Number(clusterUnitParam) : 5;

    if (isNaN(round) || isNaN(clusterUnit)) {
      return res
        .status(400)
        .json({ ok: false, error: "round and clusterUnit must be numbers" });
    }

    const result = await getAiRecommendation({ round, clusterUnit });

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("AI Recommendation error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "AI 추천 실패", detail: err?.message });
  }
}
