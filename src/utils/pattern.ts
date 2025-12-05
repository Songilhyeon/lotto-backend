export function numbersToBitmask(numbers: number[]): bigint {
  let mask = 0n;
  for (const n of numbers) mask |= 1n << BigInt(n - 1);
  return mask;
}

export function popcountBigInt(x: bigint): number {
  let n = x;
  let cnt = 0;
  while (n !== 0n) {
    if (n & 1n) cnt++;
    n >>= 1n;
  }
  return cnt;
}

export function intersectionCount(a: bigint, b: bigint): number {
  return popcountBigInt(a & b);
}

export function patternBuckets(numbers: number[], unitSize: number): number[] {
  const bucketCount = Math.ceil(45 / unitSize);
  const buckets = new Array<number>(bucketCount).fill(0);
  for (const n of numbers) {
    const idx = Math.floor((n - 1) / unitSize);
    buckets[idx]++;
  }
  return buckets;
}

export function patternKey(buckets: number[]): string {
  return buckets.join("-");
}
