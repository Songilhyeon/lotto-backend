// lottoUtils.ts
export function numbersToBitmask(numbers: number[]): bigint {
  let m = 0n;
  for (const n of numbers) m |= 1n << BigInt(n - 1);
  return m;
}

// 빠른 popcount (최대 45비트)
export function popcount(x: bigint): number {
  let c = 0;
  while (x > 0n) {
    x &= x - 1n; // Brian Kernighan’s trick
    c++;
  }
  return c;
}

export function patternBuckets(numbers: number[], size: number) {
  const bucketCount = Math.ceil(45 / size);
  const arr = Array(bucketCount).fill(0);
  for (const n of numbers) arr[Math.floor((n - 1) / size)]++;
  return arr;
}

export function patternKey(buckets: number[]) {
  return buckets.join("-");
}

/**
 * KST 기준 최신 로또 회차 계산
 */
export const getLatestRound = (): number => {
  const firstDraw = new Date(2002, 11, 7, 21, 0, 0); // 12월 = 11, KST
  const now = new Date();

  const day = now.getDay(); // 0=일, 6=토
  const diff = 6 - day; // 토요일까지 남은 일수
  const thisSaturday = new Date(now);
  thisSaturday.setDate(now.getDate() + diff);
  thisSaturday.setHours(21, 0, 0, 0);

  const referenceDate =
    now >= thisSaturday
      ? thisSaturday
      : new Date(thisSaturday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeksSinceFirst = Math.floor(
    (referenceDate.getTime() - firstDraw.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return weeksSinceFirst + 1;
};
