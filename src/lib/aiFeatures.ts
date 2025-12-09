import { PremiumLottoRecord } from "./premiumCache";

export class AiFeatureHelper {
  public freq: number[];
  public totalRounds: number;
  public latest: PremiumLottoRecord;
  public prev: PremiumLottoRecord | undefined;

  constructor(public rounds: PremiumLottoRecord[]) {
    this.totalRounds = rounds.length;
    this.freq = Array(46).fill(0);
    rounds.forEach((r) => {
      r.numbers.forEach((n) => this.freq[n]++);
    });
    this.latest = rounds[rounds.length - 1];
    this.prev = rounds[rounds.length - 2];
  }

  getHot(num: number): number {
    return this.freq[num];
  }

  getCold(num: number): number {
    return this.totalRounds - this.freq[num];
  }

  /**
   * Simple streak: latest included + prev included (weighted)
   */
  getStreakSimple(num: number): number {
    return (
      (this.latest.numbers.includes(num) ? 1 : 0) +
      (this.prev?.numbers.includes(num) ? 0.5 : 0)
    );
  }

  /**
   * Run streak: consecutive counts from latest backwards
   */
  getStreakRun(num: number, limit = 10): number {
    let streakRun = 0;
    for (let i = this.totalRounds - 1; i >= Math.max(0, this.totalRounds - limit); i--) {
      if (this.rounds[i]?.numbers.includes(num)) streakRun++;
      else break;
    }
    return streakRun;
  }

  /**
   * Pattern: Odd/Even ratio + Last Digit frequency
   */
  getPatternComplex(num: number): number {
    const lastDigit = num % 10;
    const isOdd = num % 2 === 1;

    const oddRatio =
      this.rounds.filter((r) => r.numbers.filter((x) => x % 2 === 1).length >= 3)
        .length / this.totalRounds;

    const lastDigitFreq =
      this.rounds.filter((r) => r.numbers.some((x) => x % 10 === lastDigit)).length /
      this.totalRounds;

    return oddRatio * (isOdd ? 1 : 0.5) + lastDigitFreq;
  }

  /**
   * Pattern: Simple Odd/Even + Last Digit
   */
  getPatternSimple(num: number): number {
    const isOdd = num % 2 === 1;
    const lastDigit = num % 10;
    return (isOdd ? 0.7 : 0.3) + lastDigit / 10;
  }

  /**
   * Cluster: Density based on cluster unit
   */
  getCluster(num: number, clusterUnit: number): number {
    const clusterIndex = Math.floor((num - 1) / clusterUnit);
    return (
      this.rounds.filter((r) =>
        r.numbers.some(
          (x) => Math.floor((x - 1) / clusterUnit) === clusterIndex
        )
      ).length / this.totalRounds
    );
  }

  /**
   * Density: Distance based
   */
  getDensity(num: number): number {
    let density = 0;
    for (let d = -2; d <= 2; d++) {
      const n2 = num + d;
      if (n2 >= 1 && n2 <= 45) density += this.freq[n2];
    }
    return density;
  }

  /**
   * Decay: Time decay score
   */
  getDecay(num: number, alpha = 0.85, limit = 20): number {
    let decayScore = 0;
    for (let i = 0; i < limit; i++) {
      const index = this.totalRounds - 1 - i;
      if (index < 0) break;
      if (this.rounds[index].numbers.includes(num)) decayScore += Math.pow(alpha, i);
    }
    return decayScore;
  }
}
