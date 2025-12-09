// controllers/aiRecommendController.ts
import { Request, Response } from "express";
import { recommendAIHybrid } from "../lib/aiHybrid";
import { getPremiumRange } from "../lib/premiumCache";

export interface IndependentConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  density: number;
  decay: number;
  noise: number;
}

export async function getAiRecommenderAdvancedController(
  req: Request,
  res: Response
) {
  try {
    const round = Number(req.query.round);
    const seed = Number(req.query.seed || Date.now());

    if (!round) {
      return res.status(400).json({ error: "round is required" });
    }

    // 기본 Weight
    const weight: IndependentConfig = {
      hot: 2,
      cold: 1,
      streak: 1,
      pattern: 1,
      density: 1,
      decay: 1,
      noise: 1,
    };

    // getPremiumRange 사용 (1회부터 round까지)
    const rounds = getPremiumRange(1, round);

    // recommendAIHybrid 호출 시 rounds를 넘기지 않고 round 번호만 넘기는지, 
    // 혹은 aiHybrid가 내부적으로 데이터를 조회하는지 확인 필요.
    // aiHybrid.ts를 보면 recommendAIHybrid(round, presetWeight, seed) 시그니처임.
    // rounds를 넘길 필요가 없음. aiHybrid 내부에서 getAiRecommendationAdvanced 등을 호출함.
    
    const result = await recommendAIHybrid(round, weight, seed);

    res.json(result);
  } catch (err) {
    console.error("Hybrid AI GET Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
