// types/premiumNextFreq.ts
import type { RangeKey } from "../types/insight";

/** 단일 비교 연산 */
export type CmpOp = "eq" | "gte" | "lte";

/** 구간(1-10 등) 개수 조건 */
export type RangeCondition = {
  key: RangeKey; // "1-10" | "11-20" | ...
  op: CmpOp;
  value: number; // 0~6
};

/** between 조건 */
export type BetweenCondition = {
  op: "between";
  min: number;
  max: number;
};

export type CountCondition = { op: CmpOp; value: number } | BetweenCondition;

export type PremiumNextFreqConditions = {
  /** 구간별 개수 조건들 (AND) */
  ranges?: RangeCondition[];

  /** 특정 번호 포함(AND): 모두 포함되어야 함 */
  includeNumbers?: number[];

  /** 특정 번호 제외(AND): 모두 없어야 함 */
  excludeNumbers?: number[];

  /** 홀수 개수 조건 */
  oddCount?: CountCondition;

  /** 합계 조건 (보너스는 합계에 포함하지 않는 걸 추천) */
  sum?: CountCondition;

  /** 연속수 포함 여부 */
  consecutive?: { enabled: boolean };

  /** 최소값/최대값 조건 (예: max <= 39 = 40 이상 없음) */
  minNumber?: CountCondition;
  maxNumber?: CountCondition;
};

export type PremiumNextFreqRequest = {
  startRound: number;
  endRound: number;
  includeBonus?: boolean;
  conditions: PremiumNextFreqConditions;
};

export type PremiumNextFreqResponse = {
  meta: {
    startRound: number;
    endRound: number;
    includeBonus: boolean;
    matchedRounds: number; // 조건 만족 r 개수
    nextRoundsUsed: number; // 실제로 r+1 존재해서 집계에 포함된 개수
  };
  nextNumberFreq: Record<number, number>; // 1..45
  top: { num: number; count: number }[];
  nextRangeDist: Record<RangeKey, number>; // 다음회차 기준 구간 분포 합산
  matchedRoundList?: number[]; // 옵션
};
