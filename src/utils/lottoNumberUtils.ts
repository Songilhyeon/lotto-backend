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

export const getNumbers = (item: OptimizedLottoNumber) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
];

export const getNumbersWithBonus = (
  item: OptimizedLottoNumber,
  isBonus: boolean
) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
  ...(isBonus ? [Number(item.bnusNo)] : []),
];
