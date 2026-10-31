/** Shared checks for contact details entered by users. */

/** Digits only, 7-15 long (E.164 allows up to 15), with an optional leading + and common separators. */
export function isValidMobile(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return /^\+?[0-9\s().-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15;
}

/** Tidy what the user typed without changing the number itself. */
export function cleanMobile(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
