import { Request, Response } from "express";
import { getPremiumRange } from "../lib/premiumCache";
import { recommendAIWithNextFreq } from "../lib/aiRecommendWithNextFreq";

export async function getAiNextFreqRecommendation(req: Request, res: Response) {
  try {
    const startParam = req.query.start;
    const endParam = req.query.end;
    const clusterUnitParam = req.query.clusterUnit;

    if (!startParam || !endParam)
      return res
        .status(400)
        .json({ ok: false, error: "start and end query required" });

    const start = Number(startParam);
    const end = Number(endParam);
    const clusterUnit = clusterUnitParam ? Number(clusterUnitParam) : 5;

    if (isNaN(start) || isNaN(end) || isNaN(clusterUnit))
      return res
        .status(400)
        .json({ ok: false, error: "start, end, clusterUnit must be numbers" });
    const rounds = getPremiumRange(Number(start), Number(end)); // 전체 회차 가져오기

    // weight를 query나 body로 받는다면 여기서 변환
    const weight = {
      hot: Number(req.query.hot ?? 1),
      cold: Number(req.query.cold ?? 1),
      streak: Number(req.query.streak ?? 1),
      pattern: Number(req.query.pattern ?? 1),
      cluster: Number(req.query.cluster ?? 1),
      random: Number(req.query.random ?? 1),
      nextFreq: Number(req.query.nextFreq ?? 1),
    };

    const result = await recommendAIWithNextFreq(rounds, weight);

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("AI NextFreq Recommendation error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "AI 추천 실패", detail: err?.message });
  }
}
