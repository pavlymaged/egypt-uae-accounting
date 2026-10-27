const DECIMAL = /^(-?)(\d+)(?:\.(\d*))?$/;
const ZERO = BigInt(0);

// Exact decimal maths on text values: amounts become whole numbers of the smallest unit at a fixed scale.
export function toUnits(value: string, scale: number): bigint | null {
  const match = DECIMAL.exec(value.trim().replace(/,/g, ''));
  if (!match) return null;
  const [, sign, int, frac = ''] = match;
  if (frac.length > scale && /[1-9]/.test(frac.slice(scale))) return null;
  const units = BigInt(`${int}${frac.slice(0, scale).padEnd(scale, '0')}`);
  return sign ? -units : units;
}

export function fromUnits(units: bigint, scale: number): string {
  const negative = units < ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${int}${scale > 0 ? `.${frac}` : ''}`;
}

export function sumUnits(values: bigint[]): bigint {
  return values.reduce((total, v) => total + v, ZERO);
}

export function trimZeros(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '');
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}
