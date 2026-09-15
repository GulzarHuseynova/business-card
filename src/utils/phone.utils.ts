import type { CountryPhoneOption } from '../types/phone.type';

export const DEFAULT_PHONE_COUNTRY_CODE = '+994';

export const COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = [
  { country: 'AZ', value: '+994', label: '🇦🇿 +994' },
  { country: 'TR', value: '+90', label: '🇹🇷 +90' },
  { country: 'GE', value: '+995', label: '🇬🇪 +995' },
  { country: 'RU', value: '+7', label: '🇷🇺 +7' },
  { country: 'US', value: '+1', label: '🇺🇸 +1' },
  { country: 'GB', value: '+44', label: '🇬🇧 +44' },
  { country: 'DE', value: '+49', label: '🇩🇪 +49' },
  { country: 'FR', value: '+33', label: '🇫🇷 +33' },
  { country: 'IT', value: '+39', label: '🇮🇹 +39' },
  { country: 'ES', value: '+34', label: '🇪🇸 +34' },
  { country: 'UA', value: '+380', label: '🇺🇦 +380' },
  { country: 'KZ', value: '+7', label: '🇰🇿 +7' },
  { country: 'AE', value: '+971', label: '🇦🇪 +971' },
  { country: 'SA', value: '+966', label: '🇸🇦 +966' },
  { country: 'CN', value: '+86', label: '🇨🇳 +86' },
  { country: 'IN', value: '+91', label: '🇮🇳 +91' },
];

const cleanPhoneDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');

const normalizePrefix = (value?: string | null) => {
  const text = String(value || '').trim();

  if (!text) return '';
  if (text.startsWith('+')) return `+${cleanPhoneDigits(text)}`;
  if (text.startsWith('00')) return `+${cleanPhoneDigits(text).slice(2)}`;

  return text;
};

export const splitPhoneByCountryCode = (value?: string | null, fallbackCode = DEFAULT_PHONE_COUNTRY_CODE) => {
  const normalized = normalizePrefix(value);

  if (!normalized) {
    return { countryCode: fallbackCode, nationalNumber: '' };
  }

  if (normalized.startsWith('+')) {
    const matchedOption = [...COUNTRY_PHONE_OPTIONS]
      .sort((left, right) => right.value.length - left.value.length)
      .find((option) => normalized.startsWith(option.value));

    if (matchedOption) {
      return {
        countryCode: matchedOption.value,
        nationalNumber: cleanPhoneDigits(normalized.slice(matchedOption.value.length)),
      };
    }

    return { countryCode: fallbackCode, nationalNumber: cleanPhoneDigits(normalized) };
  }

  const digits = cleanPhoneDigits(normalized);
  const nationalNumber = fallbackCode === DEFAULT_PHONE_COUNTRY_CODE && digits.startsWith('0')
    ? digits.slice(1)
    : digits;

  return { countryCode: fallbackCode, nationalNumber };
};

export const joinPhoneWithCountryCode = (countryCode: string, nationalNumber?: string | null) => {
  const digits = cleanPhoneDigits(nationalNumber);

  if (!digits) return '';

  const safeCountryCode = countryCode.startsWith('+') ? countryCode : `+${cleanPhoneDigits(countryCode)}`;
  const normalizedDigits = safeCountryCode === DEFAULT_PHONE_COUNTRY_CODE && digits.startsWith('0')
    ? digits.slice(1)
    : digits;

  return `${safeCountryCode}${normalizedDigits}`;
};

export const normalizePhoneForInput = (value?: string | null, fallbackCode = DEFAULT_PHONE_COUNTRY_CODE) => {
  const { countryCode, nationalNumber } = splitPhoneByCountryCode(value, fallbackCode);
  return joinPhoneWithCountryCode(countryCode, nationalNumber);
};

export const normalizePhoneForBackend = (value?: string | null) => normalizePhoneForInput(value) || '';
