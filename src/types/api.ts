export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  nextRound?: T;
}

export interface NumberScoreDetail {
  num: number;
  hot: number;
  cold: number;
  streak: number;
  pattern: number;
  cluster: number;
  random: number;
  nextFreq: number;
  finalRaw: number; // ✅ 원본 점수
  final: number; // ✅ 정규화 점수 (0~100)
}
