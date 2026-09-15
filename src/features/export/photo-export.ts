import { axiosInstance, publicAxiosInstance, API_BASE_URL, API_TARGET_URL } from '../../api/client';
import { normalizeAssetUrl } from '../../utils/asset-url.utils';
import {findLocalEmployeeById,findLocalEmployeeOverride} from '../../storage/local-auth/employee-local-auth';
import { findPublicCardProfile } from '../public-card/public-card-profiles';
import {getEmployeePhotoFromRecord,normalizeEmployeePhotoValue} from '../public-card/public-card-shared';
import type { HtmlExportEmployee } from '../../types/export-import.type';

export const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('az')
    .replace(/[ə]/g, 'e')
    .replace(/[ı]/g, 'i')
    .replace(/[ş]/g, 's')
    .replace(/[ç]/g, 'c')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[ğ]/g, 'g')
    .replace(/\s+/g, ' ')
    .trim();

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error || new Error('Şəkli oxumaq mümkün olmadı.'));
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.readAsDataURL(blob);
});

const htmlPhotoKeys = [
  'photoUrl',
  'PhotoUrl',
  'photoURL',
  'photoData',
  'PhotoData',
  'photoBase64',
  'profilePhotoData',
  'profilePhotoBase64',
  'profilePhotoUrl',
  'profilePhotoURL',
  'profileImageUrl',
  'profileImageData',
  'employeePhotoUrl',
  'employeePhotoData',
  'employeeImageUrl',
  'employeeImageData',
  'userPhotoUrl',
  'userPhotoData',
  'userImageUrl',
  'userImageData',
  'avatarUrl',
  'avatarData',
  'imageUrl',
  'imageURL',
  'imageData',
  'pictureUrl',
  'pictureData',
  'photo',
  'profilePhoto',
  'employeePhoto',
  'userPhoto',
  'avatar',
  'image',
  'picture',
  'photoPath',
  'imagePath',
  'fileUrl',
  'filePath',
] as const;

const htmlBackgroundKeys = [
  'cardBackgroundUrl',
  'cardBackgroundURL',
  'cardBackgroundData',
  'cardBackgroundBase64',
  'cardBackground',
  'cardBackgroundPath',
  'backgroundUrl',
  'backgroundURL',
  'backgroundData',
  'backgroundBase64',
  'backgroundImageUrl',
  'backgroundImageURL',
  'backgroundImageData',
  'backgroundImage',
  'profileBackgroundUrl',
  'profileCardBackgroundUrl',
  'coverUrl',
  'coverImageUrl',
  'bannerUrl',
] as const;

const normalizeHtmlAssetKey = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const htmlPhotoKeySet = new Set(htmlPhotoKeys.map(normalizeHtmlAssetKey));
const htmlBackgroundKeySet = new Set(htmlBackgroundKeys.map(normalizeHtmlAssetKey));
const normalizeHtmlAssetValue = normalizeEmployeePhotoValue;

const extractAssetFromRecord = (
  value: unknown,
  acceptedKeys: Set<string>,
  excludedKeyPattern: RegExp,
) => {
  const queue: Array<{ value: unknown; assetBranch: boolean }> = [{ value, assetBranch: false }];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const currentRow = queue.shift();
    if (!currentRow) continue;

    const current = currentRow.value;
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push({ value: item, assetBranch: currentRow.assetBranch }));
      continue;
    }

    if (typeof current !== 'object') {
      if (currentRow.assetBranch) {
        const asset = normalizeHtmlAssetValue(current);
        if (asset) return asset;
      }
      continue;
    }

    for (const [key, nestedValue] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizeHtmlAssetKey(key);
      if (excludedKeyPattern.test(normalizedKey)) continue;

      const isAssetKey = acceptedKeys.has(normalizedKey);
      const isAssetNestedValue =
        currentRow.assetBranch &&
        /^(url|src|href|path|value|data|base64|content|file|filename)$/i.test(key);

      if (isAssetKey || isAssetNestedValue) {
        const directAsset = normalizeHtmlAssetValue(nestedValue);
        if (directAsset) return directAsset;
      }

      if (nestedValue && (typeof nestedValue === 'object' || Array.isArray(nestedValue))) {
        queue.push({ value: nestedValue, assetBranch: currentRow.assetBranch || isAssetKey });
      }
    }
  }

  return '';
};

const extractHtmlEmployeePhoto = (value: unknown) => extractAssetFromRecord(
  value,
  htmlPhotoKeySet,
  /^(company|companylogo|logo)|background|cardbackground|cover|banner|qrcode|^qr$|socialicon/i,
);

const extractHtmlEmployeeBackground = (value: unknown) => extractAssetFromRecord(
  value,
  htmlBackgroundKeySet,
  /logo|qrcode|^qr$|socialicon|avatar|profilephoto|employeephoto|userphoto/i,
);

const getResponseRecordId = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(record.id || record.userId || record.employeeId || '').trim();
};

const findExactEmployeeRecord = (value: unknown, employeeId: string): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;

  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  const cleanId = String(employeeId || '').trim().toLowerCase();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;
    const recordId = getResponseRecordId(record).toLowerCase();
    if (recordId && recordId === cleanId) return record;

    Object.values(record).forEach((nested) => {
      if (nested && (typeof nested === 'object' || Array.isArray(nested))) queue.push(nested);
    });
  }

  return null;
};

const getEndpointIdentityValues = (value: unknown) => {
  if (!value || typeof value !== 'object') return [];

  const root = value as Record<string, unknown>;
  const candidates: unknown[] = [
    root,
    root.data,
    root.result,
    root.user,
    root.profile,
    root.employee,
    root.card,
    root.publicCard,
  ];
  const identities = new Set<string>();

  candidates.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
    const record = candidate as Record<string, unknown>;
    [record.id, record.userId, record.employeeId]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .forEach((id) => identities.add(id.toLowerCase()));
  });

  return Array.from(identities);
};

const extractExactEndpointAsset = (
  value: unknown,
  employeeId: string,
  extractor: (payload: unknown) => string,
) => {
  const exactRecord = findExactEmployeeRecord(value, employeeId);
  if (exactRecord) return extractor(exactRecord);

  const identities = getEndpointIdentityValues(value);
  if (identities.length > 0 && !identities.includes(employeeId.toLowerCase())) {
    // Endpoint gözlənilmədən başqa ID qaytarıbsa həmin şəkil/fon bu işçiyə
    // yazılmır. Bu yoxlama bir işçinin şəklinin başqasına düşməsini bloklayır.
    return '';
  }

  // /api/User/{id} və /api/cards/{id} konkret ID endpointləridir. Bəzi backend
  // cavablarında id sahəsi olmur, amma cavab yenə yalnız həmin işçiyə aiddir.
  return extractor(value);
};

const fetchExactEmployeePayloads = async (employeeId: string) => {
  const id = encodeURIComponent(employeeId);
  const requests = [
    axiosInstance.get(`/api/User/${id}`),
    publicAxiosInstance.get(`/api/cards/${id}`, {
      headers: { 'Cache-Control': 'no-cache' },
    }),
  ];

  const responses = await Promise.allSettled(requests);
  return responses.flatMap((response) => (
    response.status === 'fulfilled' ? [response.value.data] : []
  ));
};

const exactLocalEmployeeRecords = (employeeId: string) => {
  const records: Record<string, unknown>[] = [];
  const pushExact = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const recordId = String(record.id || record.userId || record.employeeId || '').trim();
    if (recordId === employeeId) records.push(record);
  };

  pushExact(findLocalEmployeeOverride({ id: employeeId }));
  pushExact(findLocalEmployeeById(employeeId));
  return records;
};

const getAssetRequestCandidates = (source: string) => {
  const values = new Set<string>();
  const raw = String(source || '').trim();
  const normalized = normalizeAssetUrl(raw);

  if (raw && !/^(data:image\/|blob:|https?:\/\/)/i.test(raw)) {
    values.add(`/${raw.replace(/^\/+/, '')}`);
  }

  if (normalized) {
    try {
      const assetUrl = new URL(normalized);
      const apiOrigins = [API_BASE_URL, API_TARGET_URL]
        .filter(Boolean)
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch {
            return '';
          }
        })
        .filter(Boolean);

      if (apiOrigins.includes(assetUrl.origin)) {
        values.add(`${assetUrl.pathname}${assetUrl.search}`);
      }
    } catch {
      // Nisbi URL artıq yuxarıda əlavə olunub.
    }

    values.add(normalized);
  }

  return Array.from(values);
};

const blobResponseToDataUrl = async (response: { data: unknown; headers?: unknown }) => {
  const imageBlob = response.data instanceof Blob ? response.data : new Blob([response.data as BlobPart]);
  const headers = response.headers && typeof response.headers === 'object'
    ? response.headers as Record<string, unknown>
    : {};
  const contentType = String(headers['content-type'] || imageBlob.type || '').toLowerCase();

  if (imageBlob.size <= 0) return '';
  if (contentType && /^(text\/|application\/(json|problem\+json|xml))/i.test(contentType)) return '';
  return blobToDataUrl(imageBlob);
};

const resolveStandaloneAsset = async (source: unknown) => {
  const normalizedSource = normalizeHtmlAssetValue(source);
  if (!normalizedSource) return '';
  if (/^data:image\//i.test(normalizedSource)) return normalizedSource;

  if (/^blob:/i.test(normalizedSource)) {
    try {
      const response = await fetch(normalizedSource);
      if (response.ok) return await blobToDataUrl(await response.blob());
    } catch {
      return '';
    }
  }

  for (const candidate of getAssetRequestCandidates(normalizedSource)) {
    const requesters = [publicAxiosInstance, axiosInstance];

    for (const requester of requesters) {
      try {
        const response = await requester.get(candidate, { responseType: 'blob' });
        const asset = await blobResponseToDataUrl(response);
        if (asset) return asset;
      } catch {
        // Eyni URL digər axios instansı və ya növbəti URL variantı ilə yoxlanılır.
      }
    }
  }

  // Şəkil base64-ə çevrilməsə də online açılış üçün absolute URL-ni saxlayırıq.
  return normalizeAssetUrl(normalizedSource);
};

const getOwnEmployeePhotoSources = (employee: HtmlExportEmployee) => {
  const record = employee as HtmlExportEmployee & { photoData?: string };
  return [record.photoData, record.photo, record.photoUrl];
};

const getOwnEmployeeBackgroundSources = (employee: HtmlExportEmployee) => [employee.cardBackgroundUrl];

const firstResolvedAsset = async (sources: unknown[]) => {
  for (const source of sources) {
    const asset = await resolveStandaloneAsset(source);
    if (asset) return asset;
  }

  return '';
};

export interface ResolvedHtmlEmployeeAssets {
  photo: string;
  background: string;
}

/**
 * HTML ixrac üçün həm profil şəklini, həm də kart fonunu yalnız həmin işçinin
 * dəqiq-ID mənbələrindən toplayır və standalone data URL-ə çevirir.
 */
export const resolveHtmlEmployeeAssets = async (
  employee: HtmlExportEmployee,
): Promise<ResolvedHtmlEmployeeAssets> => {
  const employeeId = String(employee.id || '').trim();
  const ownPhotoSources = getOwnEmployeePhotoSources(employee);
  const ownBackgroundSources = getOwnEmployeeBackgroundSources(employee);

  if (!employeeId) {
    const [photo, background] = await Promise.all([
      firstResolvedAsset(ownPhotoSources),
      firstResolvedAsset(ownBackgroundSources),
    ]);
    return { photo, background };
  }

  const endpointPayloads = await fetchExactEmployeePayloads(employeeId);
  const endpointPhotoSources = endpointPayloads
    .map((payload) => extractExactEndpointAsset(payload, employeeId, extractHtmlEmployeePhoto))
    .filter(Boolean);
  const endpointBackgroundSources = endpointPayloads
    .map((payload) => extractExactEndpointAsset(payload, employeeId, extractHtmlEmployeeBackground))
    .filter(Boolean);

  const localRecords = exactLocalEmployeeRecords(employeeId);
  const localPhotoSources = localRecords.map((record) => getEmployeePhotoFromRecord(record)).filter(Boolean);
  const localBackgroundSources = localRecords.map((record) => extractHtmlEmployeeBackground(record)).filter(Boolean);

  const exactStoredProfile = findPublicCardProfile(employeeId);
  const storedPhoto = exactStoredProfile && String(exactStoredProfile.id || '').trim() === employeeId
    ? normalizeHtmlAssetValue(exactStoredProfile.photo)
    : '';
  const storedBackground = exactStoredProfile && String(exactStoredProfile.id || '').trim() === employeeId
    ? normalizeHtmlAssetValue(exactStoredProfile.cardBackground)
    : '';

  // Inline lokal şəkil dərhal seçilir; sonra Swagger-dəki dəqiq-ID endpointlərinin
  // qaytardığı photoUrl/cardBackgroundUrl istifadə olunur. Heç vaxt başqa işçinin
  // cache və ya şəkli fallback edilmir.
  const [photo, background] = await Promise.all([
    firstResolvedAsset([
      ...ownPhotoSources.filter((source) => /^data:image\//i.test(String(source || '').trim())),
      ...endpointPhotoSources,
      ...ownPhotoSources,
      ...localPhotoSources,
      storedPhoto,
    ]),
    firstResolvedAsset([
      ...ownBackgroundSources.filter((source) => /^data:image\//i.test(String(source || '').trim())),
      ...endpointBackgroundSources,
      ...ownBackgroundSources,
      ...localBackgroundSources,
      storedBackground,
    ]),
  ]);

  return { photo, background };
};

export const resolveHtmlPhotoSource = async (employee: HtmlExportEmployee) => (
  await resolveHtmlEmployeeAssets(employee)
).photo;

export const resolveHtmlBackgroundSource = async (employee: HtmlExportEmployee) => (
  await resolveHtmlEmployeeAssets(employee)
).background;

export const prepareHtmlExportEmployees = async <T extends HtmlExportEmployee>(employees: T[]) =>
  Promise.all(employees.map(async (employee) => {
    const { photo, background } = await resolveHtmlEmployeeAssets(employee);

    return {
      ...employee,
      ...(photo ? { photo, photoUrl: photo, photoData: photo } : {}),
      ...(background ? { cardBackgroundUrl: background } : {}),
    };
  }));
