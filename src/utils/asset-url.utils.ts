import { API_BASE_URL, API_TARGET_URL } from '../api/client';

const unusableAssetValues = new Set(['', '-', '--', 'null', 'undefined', 'string', '[object object]', 'n/a', 'na', 'yoxdur', 'yox']);
const imageExtensionPattern = /\.(png|jpe?g|webp|gif|svg|bmp|avif)(\?.*)?$/i;
const rawBase64ImagePattern = /^[A-Za-z0-9+/\r\n]+={0,2}$/;

const detectRawImageMime = (value: string) => {
  if (value.startsWith('iVBOR')) return 'image/png';
  if (value.startsWith('R0lGOD')) return 'image/gif';
  if (value.startsWith('UklGR')) return 'image/webp';
  if (value.startsWith('PHN2Zy') || value.startsWith('PD94bWw')) return 'image/svg+xml';
  return 'image/jpeg';
};

export const normalizeInlineImageData = (value: unknown) => {
  const text = toText(value);
  if (!text) return '';
  if (/^data:image\//i.test(text)) return text;

  const compact = text.replace(/\s+/g, '');
  if (compact.length > 160 && rawBase64ImagePattern.test(compact)) {
    return `data:${detectRawImageMime(compact)};base64,${compact}`;
  }

  return '';
};

const toText = (value: unknown) => String(value ?? '').trim();

const stripOrigin = (value: string) => {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
};

export const isBrokenEmployeePhotoEndpoint = (value: unknown) => {
  const text = toText(value);
  if (!text) return false;

  const path = stripOrigin(text).replace(/^\/+/, '');

  return (
    /^api\/CompanyAdmin\/users\/[^/]+\/(photo|profile-photo)\/?$/i.test(path) ||
    /^api\/CompanyAdmin\/users\/photo\/[^/]+\/?$/i.test(path)
  );
};

export const isUsableAssetValue = (value: unknown) => {
  const text = toText(value);
  if (!text || unusableAssetValues.has(text.toLowerCase())) return false;
  if (isBrokenEmployeePhotoEndpoint(text)) return false;
  return true;
};

export const normalizeAssetUrl = (value: unknown, fallbackBase = '') => {
  const text = toText(value);
  if (!isUsableAssetValue(text)) return '';

  const inlineImage = normalizeInlineImageData(text);
  if (inlineImage) return inlineImage;
  if (/^blob:/i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && /^http:\/\/api-businesscard\.setclapp\.com/i.test(text)) {
      return text.replace(/^http:/i, 'https:');
    }
    return text;
  }

  if (text.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}${text}`;
  }

  const base = fallbackBase || API_BASE_URL || API_TARGET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return text;

  return `${base.replace(/\/+$/, '')}/${text.replace(/^\/+/, '')}`;
};

export const getNormalizedImageAsset = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = normalizeAssetUrl(value);
    if (normalized) return normalized;
  }

  return '';
};

export const looksLikeImageAsset = (value: unknown) => {
  const text = toText(value);
  if (!isUsableAssetValue(text)) return false;
  return /^(https?:\/\/|data:image\/|blob:|\/|uploads\/|images\/|files\/)/i.test(text) || imageExtensionPattern.test(text);
};
