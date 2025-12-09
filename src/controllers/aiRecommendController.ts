// controllers/aiRecommendController.ts
import { Request, Response } from "express";
import { getAiRecommendation } from "../lib/aiRecommender";
import { parseRecommendParams } from "../utils/requestUtils";

export async function getAiRecommendationController(
  req: Request,
  res: Response
) {
  try {
    const { params, error } = parseRecommendParams(req);

    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    if (!params.round) {
      return res.status(400).json({ ok: false, error: "round query required" });
    }

    const result = await getAiRecommendation({
      round: params.round,
      clusterUnit: params.clusterUnit,
    });

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("AI Recommendation error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "AI 추천 실패", detail: err?.message });
  }
}
