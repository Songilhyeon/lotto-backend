export type RangeKey = "1-10" | "11-20" | "21-30" | "31-40" | "41-45";

export type TodayInsightType =
  | "CONSECUTIVE_DROP" // 직전 회차 대비 조합 급변
  | "RANGE_BIAS" // 특정 구간 쏠림
  | "HOT_NUMBER" // 최근 Hot 번호
  | "BALANCED" // 뚜렷한 쏠림 없음
  | "INSUFFICIENT_DATA"; // 데이터 부족

export interface TodayInsight {
  type: TodayInsightType;
  message: string;
  /** Hot 번호의 경우 해당 번호들 */
  hotNumbers?: number[];
  /** 구간 쏠림의 경우 해당 구간 */
  biasedRange?: RangeKey;
}

/** 구간별 가중치 (번호 개수 기반) */
export const RANGE_WEIGHTS: Record<RangeKey, number> = {
  "1-10": 10,
  "11-20": 10,
  "21-30": 10,
  "31-40": 10,
  "41-45": 5,
};
