export function normalizeScores(record: Record<number, number>) {
  const values = Object.values(record);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const normalized: Record<number, number> = {};

  for (const key in record) {
    const v = record[key];
    if (max === min) normalized[key] = 1; //100;
    else normalized[key] = ((v - min) / (max - min)) * 100;
  }

  return normalized;
}
