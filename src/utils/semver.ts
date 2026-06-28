/**
 * Compares two semantic version strings (e.g. '0.8.0', '0.10.0', '1.0.0').
 * Returns:
 *   - a positive number if version `a` is greater than `b`
 *   - a negative number if version `a` is less than `b`
 *   - 0 if version `a` is equal to `b`
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;

    if (valA !== valB) {
      return valA - valB;
    }
  }

  return 0;
}
