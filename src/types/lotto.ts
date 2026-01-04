export interface LottoNumber {
  drwNo: number;
  drwNoDate: Date;
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
  bnusNo: number;
  firstPrzwnerCo: string;
  firstWinamnt: string;
  totSellamnt: string;
  firstAccumamnt: string;

  // ✅ 2등: Prisma String? -> string | null
  secondPrzwnerCo: string | null;
  secondWinamnt: string | null;
  secondAccumamnt: string | null;

  autoWin: number | null;
  semiAutoWin: number | null;
  manualWin: number | null;
}

export interface MatchResult {
  round: number;
  numbers: number[];
  bonus: number;
  matchCount: number;
  nextNumbers: number[];
}

export interface OptimizedLottoNumber
  extends Omit<
    LottoNumber,
    | "firstPrzwnerCo"
    | "firstWinamnt"
    | "totSellamnt"
    | "firstAccumamnt"
    | "secondPrzwnerCo"
    | "secondWinamnt"
    | "secondAccumamnt"
  > {
  firstPrzwnerCo: number;
  firstWinamnt: number;
  totSellamnt: number;
  firstAccumamnt: number;

  // ✅ Optimized도 null 유지 (가짜 0 방지 + 타입 충돌 제거)
  secondPrzwnerCo: number | null;
  secondWinamnt: number | null;
  secondAccumamnt: number | null;

  sum: number;
}
