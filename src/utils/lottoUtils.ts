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
