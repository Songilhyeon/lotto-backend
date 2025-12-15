export interface LottoStore {
  drwNo: number;
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
}
