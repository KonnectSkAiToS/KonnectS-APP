import { describe, it, expect } from 'vitest';
import {
  validatePhotoFile, photoContentType, MAX_PHOTO_BYTES, validateUsername, validateName, validateEmail,
  validatePhone, validateProfileForm, normalizeUsername, type ProfileFormValues,
} from './validation';

describe('profile photo validation', () => {
  it('accepts jpg, png and webp up to 5 MB', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1000, name: 'a.jpg' })).toBeNull();
    expect(validatePhotoFile({ type: 'image/png', size: 1000, name: 'a.png' })).toBeNull();
    expect(validatePhotoFile({ type: 'image/webp', size: MAX_PHOTO_BYTES, name: 'a.webp' })).toBeNull();
  });
  it('rejects other types, empty files and files over 5 MB', () => {
    expect(validatePhotoFile({ type: 'image/gif', size: 1000, name: 'a.gif' })).toMatch(/JPG, PNG or WebP/);
    expect(validatePhotoFile({ type: 'application/pdf', size: 1000, name: 'a.pdf' })).toMatch(/JPG, PNG or WebP/);
    expect(validatePhotoFile({ type: 'image/png', size: 0, name: 'a.png' })).toMatch(/empty/);
    expect(validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1, name: 'a.png' })).toMatch(/5 MB/);
  });
  it('uses the extension only when the browser reports no type', () => {
    expect(photoContentType({ type: '', name: 'x.webp' })).toBe('image/webp');
    expect(photoContentType({ type: '', name: 'x.exe' })).toBeNull();
    expect(photoContentType({ type: 'image/gif', name: 'x.png' })).toBeNull(); // a wrong type is not overridden by the name
  });
});

describe('field validation', () => {
  it('usernames: letters, numbers, underscore, 3-20', () => {
    expect(validateUsername('ada_99')).toBeNull();
    expect(validateUsername('@ada_99')).toBeNull(); // leading @ is ignored
    expect(validateUsername('ab')).toMatch(/3 to 20/);
    expect(validateUsername('a'.repeat(21))).toMatch(/3 to 20/);
    expect(validateUsername('ada.lovelace')).toMatch(/letters, numbers/);
    expect(validateUsername('ada lovelace')).toMatch(/letters, numbers/);
    expect(validateUsername('<script>')).toMatch(/letters, numbers/);
    expect(validateUsername('Admin')).toMatch(/reserved/);
    expect(normalizeUsername('  @ada ')).toBe('ada');
  });
  it('names: letters, spaces, apostrophes, hyphens', () => {
    expect(validateName('First name', "Mary-Jane O'Neil")).toBeNull();
    expect(validateName('First name', 'José')).toBeNull();
    expect(validateName('First name', 'R2D2')).toMatch(/only contain letters/);
    expect(validateName('First name', '')).toBeNull(); // legacy account with no name
    expect(validateName('First name', '', 'Ada')).toMatch(/can't be empty/);
  });
  it('email and phone', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('not-an-email')).toMatch(/valid email/);
    expect(validateEmail('a@b')).toMatch(/valid email/);
    expect(validatePhone('+44 7700 900123')).toBeNull();
    expect(validatePhone('ada@example.com')).toMatch(/looks like an email/);
    expect(validatePhone('abc')).toMatch(/valid mobile/);
    expect(validatePhone('')).toMatch(/required/);
  });
});

describe('whole-form validation', () => {
  const original: ProfileFormValues = { firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace', mobile: '', email: 'ada@example.com', hourlyRate: '' };
  const opts = { canEditEmail: true, isWorker: false };

  it('does not complain about untouched legacy values (dotted username, no phone)', () => {
    expect(validateProfileForm({ ...original, firstName: 'Adaline' }, original, opts)).toEqual({});
  });
  it('validates a field once it has been changed', () => {
    const errs = validateProfileForm({ ...original, username: 'bad name!', mobile: 'x', email: 'nope' }, original, opts);
    expect(Object.keys(errs).sort()).toEqual(['email', 'mobile', 'username']);
  });
  it('ignores the email when it cannot be edited (social sign-in)', () => {
    expect(validateProfileForm({ ...original, email: 'nope' }, original, { ...opts, canEditEmail: false })).toEqual({});
  });
  it('checks the hourly rate only for workers', () => {
    expect(validateProfileForm({ ...original, hourlyRate: '-5' }, original, opts)).toEqual({});
    expect(validateProfileForm({ ...original, hourlyRate: '-5' }, original, { ...opts, isWorker: true }).hourlyRate).toBeDefined();
  });
});
