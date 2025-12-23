import { OptimizedLottoNumber } from "../types/lotto";

export function extractNumbers(record: OptimizedLottoNumber): number[] {
  return [
    record.drwtNo1,
    record.drwtNo2,
    record.drwtNo3,
    record.drwtNo4,
    record.drwtNo5,
    record.drwtNo6,
  ];
}
