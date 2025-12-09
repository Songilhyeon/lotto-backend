// ai/AI_Variant.ts
import { recommendAIIndependent } from "./aiRecommenderIndependent";

export const AIVariants = {
  strict: {
    hot: 4,
    cold: 1,
    streak: 2,
    pattern: 1,
    density: 1,
    decay: 2,
    noise: 0,
  },
  pattern: {
    hot: 1,
    cold: 1,
    streak: 1,
    pattern: 5,
    density: 2,
    decay: 0.5,
    noise: 0,
  },
  chaos: {
    hot: 1,
    cold: 1,
    streak: 1,
    pattern: 1,
    density: 1,
    decay: 1,
    noise: 5,
  },
  cluster: {
    hot: 1,
    cold: 2,
    streak: 1,
    pattern: 1,
    density: 5,
    decay: 1,
    noise: 0.5,
  },
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
