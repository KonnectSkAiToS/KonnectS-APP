import { isValidEmail, isValidMobile } from '../../lib/contactValidation';

// ---------- profile photo ----------
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const EXTENSION_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** The content type to upload with, or null when the file is not an allowed image. */
export function photoContentType(file: { type: string; name?: string }): string | null {
  if ((ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) return file.type;
  // Some browsers report no type for .webp; fall back to the extension only in that case
  const ext = file.name?.split('.').pop()?.toLowerCase();
  if (!file.type && ext && EXTENSION_TYPES[ext]) return EXTENSION_TYPES[ext];
  return null;
}

export function validatePhotoFile(file: { type: string; size: number; name?: string }): string | null {
  if (!photoContentType(file)) return 'Please choose a JPG, PNG or WebP image.';
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_PHOTO_BYTES) return 'That image is too large. The maximum size is 5 MB.';
  return null;
}

// ---------- text fields ----------
export const NAME_MAX = 50;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const RESERVED_USERNAMES = ['admin', 'root', 'system', 'konnects', 'support', 'alex_m', 'sarah_m', 'elena_r', 'david_c', 'marcus_v', 'james_w'];

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '');
}

export function validateName(label: string, value: string, original = ''): string | null {
  const v = value.trim();
  if (!v) return original.trim() ? `${label} can't be empty.` : null; // legacy accounts may have no name yet
  if (v.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer.`;
  if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(v)) return `${label} can only contain letters, spaces, apostrophes and hyphens.`;
  return null;
}

export function validateUsername(value: string): string | null {
  const u = normalizeUsername(value);
  if (!u) return 'Username is required.';
  if (u.length < 3 || u.length > 20) return 'Username must be 3 to 20 characters.';
  if (!USERNAME_PATTERN.test(u)) return 'Use letters, numbers and underscores only.';
  if (RESERVED_USERNAMES.includes(u.toLowerCase())) return 'That username is reserved. Please choose another.';
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email address is required.';
  return isValidEmail(value) ? null : 'Enter a valid email address, e.g. name@example.com.';
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) return 'Mobile number is required.';
  if (value.includes('@')) return 'That looks like an email address. Enter your phone number, e.g. +44 7700 900123.';
  return isValidMobile(value) ? null : 'Enter a valid mobile number with country code, e.g. +44 7700 900123.';
}

export function validateHourlyRate(value: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000) return 'Enter an hourly rate between 0 and 10,000.';
  return null;
}

// ---------- whole form ----------
export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  username: string;
  mobile: string;
  email: string;
  hourlyRate: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

/**
 * Validates the edit form. Fields the user did not change are not re-validated (except names being
 * emptied), so an older account with, say, a dotted username or no phone can still save other edits.
 */
export function validateProfileForm(
  values: ProfileFormValues,
  original: ProfileFormValues,
  options: { canEditEmail: boolean; isWorker: boolean }
): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const set = (k: keyof ProfileFormValues, msg: string | null) => { if (msg) errors[k] = msg; };

  set('firstName', validateName('First name', values.firstName, original.firstName));
  set('lastName', validateName('Last name', values.lastName, original.lastName));

  if (normalizeUsername(values.username) !== normalizeUsername(original.username)) set('username', validateUsername(values.username));
  if (values.mobile.trim() !== original.mobile.trim()) set('mobile', validatePhone(values.mobile));
  if (options.canEditEmail && values.email.trim().toLowerCase() !== original.email.trim().toLowerCase()) set('email', validateEmail(values.email));
  if (options.isWorker) set('hourlyRate', validateHourlyRate(values.hourlyRate));
  return errors;
}
