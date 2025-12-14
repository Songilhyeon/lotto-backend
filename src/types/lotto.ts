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
    "firstPrzwnerCo" | "firstWinamnt" | "totSellamnt" | "firstAccumamnt"
  > {
  firstPrzwnerCo: number;
  firstWinamnt: number;
  totSellamnt: number;
  firstAccumamnt: number;
  sum: number;
}
