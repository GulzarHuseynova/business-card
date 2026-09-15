const SOCIAL_LABEL_PATTERN = /^(linkedin|facebook|instagram|youtube|tiktok|twitter|x(?:\.com)?|telegram|sosial(?:\s+şəbəkə(?:lər)?)?|social(?:\s+media)?)\s*$/i;
const SOCIAL_URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:linkedin|facebook|instagram|youtube|tiktok|twitter|x)\.com\//i;

const normalizeComparableUrl = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/+$/, '');

/**
 * Əlavə məlumat sahəsinə əvvəlki versiyalardan düşmüş sosial linkləri təmizləyir.
 * Sosial hesablar ayrıca ikonlarla göstərildiyi üçün yalnız həmin təkrarlanan
 * hissələr silinir, digər əlavə məlumat olduğu kimi saxlanılır.
 */
export const stripSocialLinksFromAdditionalInfo = (
  value: unknown,
  socialUrls: unknown[] = [],
) => {
  const knownSocialUrls = new Set(
    socialUrls.map(normalizeComparableUrl).filter(Boolean),
  );

  return String(value ?? '')
    .split(/[;\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const separatorIndex = part.indexOf(':');
      const rawLabel = separatorIndex >= 0 ? part.slice(0, separatorIndex).trim() : '';
      const possibleValue = separatorIndex >= 0 ? part.slice(separatorIndex + 1).trim() : part;
      const normalizedPart = normalizeComparableUrl(part);
      const normalizedValue = normalizeComparableUrl(possibleValue);

      return !(
        SOCIAL_LABEL_PATTERN.test(rawLabel) ||
        SOCIAL_URL_PATTERN.test(part) ||
        knownSocialUrls.has(normalizedPart) ||
        knownSocialUrls.has(normalizedValue)
      );
    })
    .join('; ');
};
