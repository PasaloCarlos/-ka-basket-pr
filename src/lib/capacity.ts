// Pure capacity math for registration caps. No I/O.
// Per-tournament cap is the primitive; aggregateFormatCapacity rolls up the
// divisions that share one public category card (e.g. 1v1 femenino + masculino).

export type CapacityInput = { count: number; max: number | null };
export type CapacityState = { isFull: boolean; spotsLeft: number | null };

export function capacityState({ count, max }: CapacityInput): CapacityState {
  if (max == null) return { isFull: false, spotsLeft: null };
  return { isFull: count >= max, spotsLeft: Math.max(0, max - count) };
}

export function aggregateFormatCapacity(
  items: CapacityInput[]
): CapacityState & { count: number } {
  const count = items.reduce((sum, i) => sum + i.count, 0);
  if (items.length === 0) return { isFull: false, spotsLeft: null, count };

  const hasCap = items.some((i) => i.max != null);
  const anyHasSpace = items.some((i) => i.max == null || i.count < i.max);
  const anyUncapped = items.some((i) => i.max == null);

  const spotsLeft = anyUncapped
    ? null
    : items.reduce((sum, i) => sum + Math.max(0, (i.max as number) - i.count), 0);

  return { isFull: hasCap && !anyHasSpace, spotsLeft, count };
}
