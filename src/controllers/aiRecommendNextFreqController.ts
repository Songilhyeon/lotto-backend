import { Request, Response } from "express";
import { getPremiumRange } from "../lib/premiumCache";
import {
  recommendAIWithNextFreq,
  WeightConfig,
} from "../lib/aiRecommendWithNextFreq";

// GET 쿼리 파라미터를 안전하게 파싱
function parseQueryParams(req: Request): {
  start: number;
  end: number;
  clusterUnit: number;
  weight: WeightConfig;
  error?: string;
} {
  const { start, end, clusterUnit } = req.query;

  if (!start || !end || !clusterUnit) {
    return {
      start: 0,
      end: 0,
      clusterUnit: 5,
      weight: {} as WeightConfig,
      error: "start, end, clusterUnit 쿼리가 필요합니다.",
    };
  }

  // weight 파싱, 없으면 기본값 1
  const weight: WeightConfig = {
    hot: parseFloat((req.query.hot as string) ?? "1"),
    cold: parseFloat((req.query.cold as string) ?? "1"),
    streak: parseFloat((req.query.streak as string) ?? "1"),
    pattern: parseFloat((req.query.pattern as string) ?? "1"),
    cluster: parseFloat((req.query.cluster as string) ?? "1"),
    random: parseFloat((req.query.random as string) ?? "1"),
    nextFreq: parseFloat((req.query.nextFreq as string) ?? "1"),
  };

  return {
    start: parseInt(start as string, 10),
    end: parseInt(end as string, 10),
    clusterUnit: parseInt(clusterUnit as string, 10),
    weight,
  };
}

export async function getAiRecommendNextFreqController(
  req: Request,
  res: Response
) {
  try {
    const { start, end, clusterUnit, weight, error } = parseQueryParams(req);

    if (error) return res.status(400).json({ ok: false, error });

    const rounds = getPremiumRange(start, end);

    const result = await recommendAIWithNextFreq(rounds, weight, clusterUnit);

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("AI NextFreq Recommendation error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "AI 점수 분석 실패", detail: err?.message });
  }
}
