import { lottoStoreByIdentity } from "../lib/lottoCache";

export const normalize = (v: string) => v.replace(/\s+/g, " ").trim();

export function getStoreTimeline(store: string, address: string) {
  const key = `${normalize(store)}|${normalize(address)}`;

  const list = lottoStoreByIdentity.get(key);
  if (!list) return [];

  const yearMap = new Map<number, any[]>();

  list.forEach((s) => {
    const year = s.drwNoDate ? s.drwNoDate.getFullYear() : 0;

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }

    yearMap.get(year)!.push({
      drwNo: s.drwNo,
      drwNoDate: s.drwNoDate,
      rank: s.rank,
      autoWin: s.autoWin,
      semiAutoWin: s.semiAutoWin,
      manualWin: s.manualWin,
    });
  });

  return Array.from(yearMap.entries())
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => b.drwNo - a.drwNo),
    }))
    .sort((a, b) => b.year - a.year);
}
