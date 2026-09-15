import { API_TARGET_URL } from '../api/client';
import { normalizeAssetUrl, normalizeInlineImageData } from './asset-url.utils';
import { readPersistentImage, writePersistentImage } from '../storage/persistent-image-cache';

const IMAGE_PATH_PATTERN = /(?:\/api\/uploads\/|\/uploads\/|\/images\/|\/files\/|\/logos\/|\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:\?|#|$))/i;

export const isInlineImageDataUrl = (value: unknown) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value ?? '').trim());

export const fileToImageDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    if (isInlineImageDataUrl(result)) resolve(result);
    else reject(new Error('Şəkil Base64 formatına çevrilmədi.'));
  };
  reader.onerror = () => reject(reader.error || new Error('Şəkil oxunmadı.'));
  reader.readAsDataURL(file);
});

const isLikelyImageAsset = (value: string) => {
  if (!value) return false;
  if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return true;
  return IMAGE_PATH_PATTERN.test(value);
};

const apiTargetHost = (() => {
  try {
    return new URL(API_TARGET_URL).host.toLowerCase();
  } catch {
    return '';
  }
})();

/**
 * Development zamanı backend şəkillərini birbaşa absolute URL ilə fetch etmək
 * CORS xətası yaradır. Eyni faylı Vite proxy üzərindən /api və ya /uploads yolu
 * ilə oxuyuruq. Sosial şəbəkə URL-ləri bu funksiyaya buraxılmır.
 */
export const getSafeImageFetchUrl = (value: unknown) => {
  const normalized = normalizeAssetUrl(value);
  if (!normalized || !isLikelyImageAsset(normalized)) return '';
  if (/^data:image\//i.test(normalized) || /^blob:/i.test(normalized)) return normalized;

  try {
    const parsed = new URL(normalized, typeof window !== 'undefined' ? window.location.origin : API_TARGET_URL);
    const isApiAsset = Boolean(apiTargetHost && parsed.host.toLowerCase() === apiTargetHost);
    const isUploadPath = /^(?:\/api\/uploads\/|\/uploads\/)/i.test(parsed.pathname);

    if (isApiAsset || isUploadPath) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return normalized;
  } catch {
    return normalized;
  }
};

export const imageAssetToDataUrl = async (
  value: unknown,
  persistentKey?: string,
): Promise<string> => {
  const existingInline = normalizeInlineImageData(value);
  if (existingInline) {
    if (persistentKey) void writePersistentImage(persistentKey, existingInline);
    return existingInline;
  }

  const cachedImage = persistentKey ? await readPersistentImage(persistentKey) : '';
  const fetchUrl = getSafeImageFetchUrl(value);
  if (!fetchUrl || /^blob:/i.test(fetchUrl)) return cachedImage;

  // API şəkilləri eyni-origin /api və /uploads proxy yolu ilə oxunur. Başqa
  // domenlər CORS icazəsi vermirsə son IndexedDB nüsxəsi istifadə olunur.
  if (/^https?:\/\//i.test(fetchUrl)) {
    try {
      if (typeof window === 'undefined' || new URL(fetchUrl).origin !== window.location.origin) {
        return cachedImage;
      }
    } catch {
      return cachedImage;
    }
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-cache',
    });

    if (!response.ok) return cachedImage;

    const blob = await response.blob();
    if (!blob.type.toLowerCase().startsWith('image/')) return cachedImage;

    const dataUrl = await fileToImageDataUrl(blob);
    if (persistentKey) await writePersistentImage(persistentKey, dataUrl);
    return dataUrl || cachedImage;
  } catch {
    return cachedImage;
  }
};
