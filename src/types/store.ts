export interface LottoStore {
  drwNo: number;
  store: string;
  address: string;
  rank: number;
  autoWin: number | null;
  semiAutoWin: number | null;
  manualWin: number | null;
}
