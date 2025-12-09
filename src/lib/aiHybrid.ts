// ai/AI_Hybrid.ts
import {
  getAiRecommendationAdvanced,
  WeightConfig,
  AiPreset,
} from "./aiRecommenderAdvanced";
import { recommendAIIndependent } from "./aiRecommenderIndependent";
import { AIVariants } from "./aiVariant";

type NumberScore = { num: number; final: number };

export interface IndependentConfig {
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  density: number;
  decay: number;
  noise: number;
}
// 유틸 타입: AIVariant 키들
type AIVariantKey = keyof typeof AIVariants;

// 모델 출력 공통 타입 (getAiRecommendationAdvanced 과 recommendAIIndependent 둘 다 scores 배열을 가짐)
type ModelWithScores = {
  scores: Array<{
    num: number;
    final: number;
    // 다른 필드들도 있어도 무방
  }>;
  // combination?: number[]; // 필요하면 포함
};

export async function recommendAIHybrid(
  round: number,
  presetWeight: IndependentConfig,
  seed: number = Date.now()
) {
  // 1. nextFreq 모델 (기존 확장형 recommend)
  // WeightConfig와 IndependentConfig의 타입 불일치 해결
  const advancedWeight = {
    hot: presetWeight.hot,
    cold: presetWeight.cold,
    streak: presetWeight.streak,
    pattern: presetWeight.pattern,
    cluster: presetWeight.density, // density -> cluster 매핑
    random: presetWeight.noise, // noise -> random 매핑
    nextFreq: 1, // 기본값 설정
  };

  const nextFreqModel = await getAiRecommendationAdvanced(
    round,
    { name: "HybridPreset", weight: advancedWeight },
    5,
    seed
  );

  // 2. Independent 모델 (기본)
  const independentModel: ModelWithScores = (await recommendAIIndependent(
    round,
    {
      hot: 2,
      cold: 1,
      streak: 1,
      pattern: 1,
      density: 1,
      decay: 1,
      noise: 1,
    },
    seed
  )) as unknown as ModelWithScores;

  // 3. Variant 모델들 (최적화: 루프 돌면서 호출하되, 내부적으로 캐시된 데이터를 쓰거나 가볍게 처리)
  // *참고*: recommendAIIndependent 내부에서 getPremiumRange를 호출하므로, 
  // 반복 호출 시 Redis/Memory 캐시가 동작하여 성능 저하는 크지 않을 것으로 예상됨.
  // 만약 더 최적화하려면 recommendAIIndependent를 리팩토링하여 features 계산과 scoring을 분리해야 함.
  // 현재는 타입 에러 수정 및 로직 안정화에 집중.

  const variantModels: ModelWithScores[] = [];

  for (const v of Object.keys(AIVariants) as (keyof typeof AIVariants)[]) {
    const model = await recommendAIIndependent(
      round,
      AIVariants[v],
      seed + v.length
    );

    variantModels.push(model as unknown as ModelWithScores);
  }

  // 점수 합산
  const agg = Array(46).fill(0);

  const addScore = (model: ModelWithScores, weight = 1) => {
    model.scores.forEach((s) => {
      agg[s.num] += s.final * weight;
    });
  };

  addScore(nextFreqModel, 1.5);
  addScore(independentModel, 1.0);
  variantModels.forEach((m) => addScore(m, 0.8));

  // 최종 랭킹
  const ranked = [];
  for (let num = 1; num <= 45; num++) {
    ranked.push({ num, score: agg[num] });
  }
  ranked.sort((a, b) => b.score - a.score);

  const combination = ranked.slice(0, 6).map((r) => r.num);

  return {
    combination,
    scores: ranked,
    seed,
  };
}
