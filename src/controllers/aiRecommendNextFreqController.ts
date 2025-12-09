import { Request, Response } from "express";
import { getPremiumRange } from "../lib/premiumCache";
import { recommendAIWithNextFreq } from "../lib/aiRecommendWithNextFreq";
import { parseRecommendParams } from "../utils/requestUtils";

export async function getAiRecommendNextFreqController(req: Request, res: Response) {
  try {
    const { params, error } = parseRecommendParams(req);

    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    if (!params.start || !params.end) {
      return res
        .status(400)
        .json({ ok: false, error: "start and end query required" });
    }

    const rounds = getPremiumRange(params.start, params.end);

    // Default weight if not provided
    const weight = {
      hot: params.weight?.hot ?? 1,
      cold: params.weight?.cold ?? 1,
      streak: params.weight?.streak ?? 1,
      pattern: params.weight?.pattern ?? 1,
      cluster: params.weight?.cluster ?? 1,
      random: params.weight?.random ?? 1,
      nextFreq: params.weight?.nextFreq ?? 1,
    };

    const result = await recommendAIWithNextFreq(rounds, weight, params.clusterUnit);

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("AI NextFreq Recommendation error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "AI 추천 실패", detail: err?.message });
  }
}
