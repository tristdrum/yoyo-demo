export type WeightedItem = { weight: number };

export function weightedPick<T extends WeightedItem>(items: T[], rng: () => number): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(item.weight, 0), 0);
  if (total <= 0) {
    return null;
  }
  const threshold = rng() * total;
  let cursor = 0;
  for (const item of items) {
    cursor += Math.max(item.weight, 0);
    if (threshold <= cursor) {
      return item;
    }
  }
  return items[items.length - 1] ?? null;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

export function toIso(date: Date): string {
  return date.toISOString();
}
