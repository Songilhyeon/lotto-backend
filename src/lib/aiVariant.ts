// ai/AI_Variant.ts
import { recommendAIIndependent } from "./aiRecommenderIndependent";

export const AIVariants = {
  // 안정형 - 자주 나오고, 최근에도 계속 나온 번호
  strict: {
    hot: 4,
    cold: 1,
    streak: 2,
    pattern: 1,
    density: 1,
    decay: 2,
    noise: 0,
  },
  // 패턴형 - 숫자 자체의 성질과 패턴
  pattern: {
    hot: 1,
    cold: 1,
    streak: 1,
    pattern: 5,
    density: 2,
    decay: 0.5,
    noise: 0,
  },
  // 혼합형 / 실험형 전략 - 확률 실험 + 다양성 탐색
  chaos: {
    hot: 1,
    cold: 1,
    streak: 1,
    pattern: 1,
    density: 1,
    decay: 1,
    noise: 2,
  },
  // 군집형 - 번호 구간의 몰림 현상에 주목
  cluster: {
    hot: 1,
    cold: 2,
    streak: 1,
    pattern: 1,
    density: 5,
    decay: 1,
    noise: 0.1,
  },
  // 최근형 -
  decay: {
    hot: 1,
    cold: 1,
    streak: 1,
    pattern: 1,
    density: 1,
    decay: 5,
    noise: 0,
  },
};

export async function recommendAIVariant(
  name: keyof typeof AIVariants,
  round: number,
  seed = Date.now()
) {
  return recommendAIIndependent(round, AIVariants[name], seed);
}
