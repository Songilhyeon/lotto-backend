import { Request } from "express";

export interface RecommendParams {
  round?: number;
  start?: number;
  end?: number;
  clusterUnit: number;
  seed: number;
  weight?: Record<string, number>;
}

export function parseRecommendParams(req: Request): {
  params: RecommendParams;
  error?: string;
} {
  const query = req.query;
  const body = req.body;

  // 1. Round or Start/End
  let round: number | undefined;
  let start: number | undefined;
  let end: number | undefined;

  if (query?.round || body?.round) {
    round = Number(query?.round || body?.round);
    if (isNaN(round))
      return { params: {} as any, error: "round must be a number" };
  }

  if (query?.start || body?.start) {
    start = Number(query?.start || body?.start);
    if (isNaN(start))
      return { params: {} as any, error: "start must be a number" };
  }

  if (query?.end || body?.end) {
    end = Number(query?.end || body?.end);
    if (isNaN(end)) return { params: {} as any, error: "end must be a number" };
  }

  // 2. Common params
  const clusterUnit = Number(query?.clusterUnit || body?.clusterUnit || 5);
  const seed = Number(query?.seed || body?.seed || Date.now());

  if (isNaN(clusterUnit))
    return { params: {} as any, error: "clusterUnit must be a number" };
  if (isNaN(seed)) return { params: {} as any, error: "seed must be a number" };

  // 3. Weight (optional, from query)
  // Extract known weight keys if present in query
  const weightKeys = [
    "hot",
    "cold",
    "streak",
    "pattern",
    "cluster",
    "random",
    "nextFreq",
    "density",
    "decay",
    "noise",
  ];
  const weight: Record<string, number> = {};
  let hasWeight = false;

  weightKeys.forEach((key) => {
    if (query[key] !== undefined) {
      const val = Number(query[key]);
      if (!isNaN(val)) {
        weight[key] = val;
        hasWeight = true;
      }
    }
  });

  return {
    params: {
      round,
      start,
      end,
      clusterUnit,
      seed,
      weight: hasWeight ? weight : undefined,
    },
  };
}
