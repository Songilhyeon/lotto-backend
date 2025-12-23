import { Request, Response } from "express";
import { recommendAIVariant } from "../lib/aiVariant";
import { sortedLottoCache } from "../lib/lottoCache";
import { extractNumbers } from "../utils/lottoNumberUtils";

export async function getAiRecommenderVariantController(
  req: Request,
  res: Response
) {
  try {
    const { round, variant, seed } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------
    if (!round || typeof round !== "number") {
      return res.status(400).json({ message: "round is required" });
    }

    if (!variant || typeof variant !== "string") {
      return res.status(400).json({ message: "variant is required" });
    }

    // -----------------------------
    // AI 실행
    // -----------------------------
    const result = await recommendAIVariant(
      variant as any,
      round,
      seed ?? Date.now()
    );

    // -----------------------------
    // 다음 회차 정보 (있으면 포함)
    // -----------------------------
    const nextRecord = sortedLottoCache.find((r) => r.drwNo === round + 1);

    const nextRound = nextRecord
      ? {
          round: nextRecord.drwNo,
          numbers: extractNumbers(nextRecord),
          bonus: nextRecord.bnusNo,
        }
      : null;

    return res.json({
      ...result,
      nextRound,
    });
  } catch (err) {
    console.error("[AI Variant Error]", err);
    return res.status(500).json({
      message: "AI Variant 추천 중 오류가 발생했습니다",
    });
  }
}
