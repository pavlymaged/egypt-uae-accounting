const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

function trimZeros(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '');
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

export function storedRate(stored: string): string {
  return DECIMAL.test(stored.trim()) ? trimZeros(stored.trim()) : stored;
}

// Text-only decimal shift so the stored digits are shown exactly, with no float arithmetic.
export function ratePercent(stored: string): string {
  const match = DECIMAL.exec(stored.trim());
  if (!match) return stored;
  const [, sign, int, frac = ''] = match;
  const padded = frac.padEnd(2, '0');
  const whole = `${int}${padded.slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const rest = padded.slice(2);
  return `${sign}${trimZeros(rest ? `${whole}.${rest}` : whole)}%`;
}
