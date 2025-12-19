export interface LottoStore {
  drwNo: number;
  drwNoDate?: Date | null; // ✅ Date 유지
  store: string;
  address: string;
  rank: number;
  autoWin: number | null;
  semiAutoWin: number | null;
  manualWin: number | null;
}

export interface StoreHistoryItem {
  round: number;
  autoWin: number;
  semiAutoWin: number;
  manualWin: number;
  drwNoDate: string;
}

export type StorePatternType =
  | "RECENT_SPIKE"
  | "LONG_DORMANT"
  | "PROMOTION_2_TO_1"
  | "HIGH_MANUAL_RATIO";

export interface StorePatternResult {
  type: StorePatternType;
  score: number; // 0~100
  description: string;
}

export interface StorePatternItem {
  store: string;
  address: string;
  region: string;
  anomalyScore: number;
  patterns: StorePatternResult[];
  rank: 1 | 2;
}
