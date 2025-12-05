// src/types/index.ts
// 공용 타입 정의

export interface RoundData {
  round: number;
  numbers: number[]; // 기본 6개 (정렬되어 있어도 되고, 내부에서 정렬 가능)
  bonus?: number | null; // 보너스 번호 (없으면 null)
  date?: string;
}

export interface PerNumberNextFreq {
  // e.g. { 3: { 1: 5, 7: 2 } }
  [selectedNumber: number]: { [nextNumber: number]: number };
}

export interface KMatchNextFreq {
  // keys: "1","2","3","4+"
  [k: string]: { [nextNumber: number]: number };
}

export interface PatternNextFreq {
  patternKey: string;
  freq: { [nextNumber: number]: number };
}

export interface PremiumAnalysisResult {
  round: number;
  bonusIncluded: boolean;
  perNumberNextFreq: PerNumberNextFreq;
  kMatchNextFreq: KMatchNextFreq;
  pattern10NextFreq: PatternNextFreq;
  pattern7NextFreq: PatternNextFreq;
  recentFreq: { [num: number]: number };
  generatedAt: string;
}
