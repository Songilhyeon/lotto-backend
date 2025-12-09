// controllers/aiRecommendController.ts
import { Request, Response } from "express";
import {
  getAiRecommendationAdvanced,
  AiPresets,
} from "../lib/aiRecommenderAdvanced";

export async function getAiRecommenderAdvancedController(
  req: Request,
  res: Response
) {
  try {
    const { round, presetName, clusterUnit, seed } = req.body;

    if (!round || typeof round !== "number") {
      return res.status(400).json({ error: "round는 필수 숫자입니다." });
    }

    const preset = AiPresets.find((p) => p.name === presetName);
    if (!preset)
      return res.status(400).json({ error: "유효하지 않은 preset입니다." });

    // 기존 aiRecommenderAdvanced 사용
    const result = await getAiRecommendationAdvanced(
      round,
      preset,
      clusterUnit,
      seed
    );

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "서버 에러" });
  }
}
