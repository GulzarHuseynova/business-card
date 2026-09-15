import { axiosInstance } from '../../api/client';
import { cleanObject } from './api-fallback';
import { normalizeAssetUrl } from '../../utils/asset-url.utils';
import { findStringDeep, isRecord } from '../../utils/api.utils';
import { stripSocialLinksFromAdditionalInfo } from '../profile/profile-info';
import type { AddUserPayload, UpdateUserPayload } from '../../types/company.type';

export type EmployeeSocialPayload = Pick<Partial<AddUserPayload & UpdateUserPayload>, 'linkedin' | 'facebook' | 'instagram'>;

type CustomSocialAccount = { platformName?: string; profileUrl?: string; iconUrl?: string };

const primarySocialKeys = ['linkedin', 'facebook', 'instagram'];

const normalizeCustomSocialAccounts = (value: unknown): CustomSocialAccount[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((account) => {
      const row = isRecord(account) ? account : {};
      return {
        platformName: String(row.platformName ?? row.platform ?? row.name ?? row.type ?? '').trim(),
        profileUrl: String(row.profileUrl ?? row.url ?? row.link ?? row.value ?? '').trim(),
        iconUrl: String(row.iconUrl ?? row.icon ?? row.imageUrl ?? '').trim(),
      };
    })
    .filter((account) => account.platformName || account.profileUrl)
    .filter((account) => {
      const marker = `${account.platformName || ''} ${account.profileUrl || ''}`.toLowerCase();
      return !primarySocialKeys.some((key) => marker.includes(key));
    });
};


export const backendPhotoUrlValue = (value: unknown) => {
  const text = String(value ?? '').trim();
  // JSON profil payload-ına yalnız backend URL göndərilir. Yeni şəkil ayrıca
  // /api/CompanyAdmin/users/{id}/photo endpointinə multipart/form-data ilə yüklənir.
  return /^https?:\/\//i.test(text) ? text : '';
};

const backendCardBackgroundValue = (value: unknown) => {
  const text = String(value ?? '').trim();
  return /^(https?:\/\/|\/api\/uploads\/|data:image\/)/i.test(text) ? text : '';
};

export const socialValue = (value?: string) => String(value ?? '').trim();

export const buildEmployeeSocialAccounts = (payload: EmployeeSocialPayload) => {
  return [
    { platform: 'LinkedIn', url: socialValue(payload.linkedin) },
    { platform: 'Facebook', url: socialValue(payload.facebook) },
    { platform: 'Instagram', url: socialValue(payload.instagram) },
  ]
    .filter((account) => account.url)
    .map((account) => ({
      platform: account.platform,
      platformName: account.platform,
      socialPlatform: account.platform,
      socialMediaName: account.platform,
      name: account.platform,
      type: account.platform,
      url: account.url,
      link: account.url,
      value: account.url,
      href: account.url,
      profileUrl: account.url,
      accountUrl: account.url,
      socialUrl: account.url,
    }));
};

export const getPayloadString = (payload: Record<string, unknown>, key: string) => String(payload[key] ?? '').trim();

export const getSwaggerSocialValues = (payload: Record<string, unknown>) => ({
  linkedinUrl: getPayloadString(payload, 'linkedinUrl') || getPayloadString(payload, 'linkedInUrl') || getPayloadString(payload, 'linkedin'),
  facebookUrl: getPayloadString(payload, 'facebookUrl') || getPayloadString(payload, 'facebook'),
  instagramUrl: getPayloadString(payload, 'instagramUrl') || getPayloadString(payload, 'instagram'),
});

const buildContactInfos = (payload: Record<string, unknown>) => {
  const rows = [
    { contactType: 'Phone1', value: getPayloadString(payload, 'phone1') },
    { contactType: 'Phone2', value: getPayloadString(payload, 'phone2') },
    { contactType: 'WhatsApp', value: getPayloadString(payload, 'whatsappPhone') || getPayloadString(payload, 'whatsapp') },
    { contactType: 'Extension', value: getPayloadString(payload, 'extensionNumber') || getPayloadString(payload, 'internalNumber') },
    { contactType: 'Email', value: getPayloadString(payload, 'email') || getPayloadString(payload, 'gmail') },
  ];

  return rows
    .filter((item) => item.value)
    .map((item, index) => ({
      ...item,
      label: item.contactType,
      displayOrder: index,
    }));
};

const normalizeRoleValue = (value: unknown) => {
  const role = Number(value ?? 0);
  return Number.isInteger(role) && role >= 0 && role <= 2 ? role : 0;
};

export const buildSwaggerCreateUserPayload = (
  payload: Record<string, unknown>,
) => {
  const socials = getSwaggerSocialValues(payload);
  const customSocialAccounts = normalizeCustomSocialAccounts(payload.socialAccounts);
  const contactInfos = buildContactInfos(payload);
  const additionalInfo = stripSocialLinksFromAdditionalInfo(
    getPayloadString(payload, 'additionalInfo'),
    Object.values(socials),
  );

  // CreateUserDto əlavə property qəbul etmir. Yalnız Swagger modelində olan
  // sahələri göndəririk; photoUrl/cardBackgroundUrl/canEdit/dateOfBirth kimi
  // sahələr POST zamanı 400 Bad Request yarada bilər.
  return cleanObject({
    companyId: getPayloadString(payload, 'companyId'),
    firstName: getPayloadString(payload, 'firstName'),
    lastName: getPayloadString(payload, 'lastName'),
    middleName: getPayloadString(payload, 'middleName'),
    jobTitle: getPayloadString(payload, 'jobTitle'),
    phone1: getPayloadString(payload, 'phone1'),
    phone2: getPayloadString(payload, 'phone2'),
    whatsappPhone: getPayloadString(payload, 'whatsappPhone') || getPayloadString(payload, 'whatsapp'),
    extensionNumber: getPayloadString(payload, 'extensionNumber') || getPayloadString(payload, 'internalNumber'),
    additionalInfo,
    email: getPayloadString(payload, 'email') || getPayloadString(payload, 'email1') || getPayloadString(payload, 'gmail'),
    password: getPayloadString(payload, 'password') || getPayloadString(payload, 'code'),
    role: normalizeRoleValue(payload.role),
    isActive: payload.isActive ?? true,
    googleMapsUrl: getPayloadString(payload, 'googleMapsUrl'),
    address: getPayloadString(payload, 'address') || getPayloadString(payload, 'homeAddress'),
    birthday: getPayloadString(payload, 'dateOfBirth') || getPayloadString(payload, 'birthDate') || getPayloadString(payload, 'birthday'),
    linkedinUrl: socials.linkedinUrl,
    facebookUrl: socials.facebookUrl,
    instagramUrl: socials.instagramUrl,
    socialAccounts: customSocialAccounts,
    contactInfos: contactInfos.length > 0 ? contactInfos : undefined,
  });
};

export const buildSwaggerUpdateUserPayload = (
  payload: Record<string, unknown>,
) => {
  const socials = getSwaggerSocialValues(payload);
  const photoUrl = backendPhotoUrlValue(getPayloadString(payload, 'photoUrl') || getPayloadString(payload, 'photo'));
  const contactInfos = buildContactInfos(payload);
  const additionalInfo = stripSocialLinksFromAdditionalInfo(
    getPayloadString(payload, 'additionalInfo'),
    Object.values(socials),
  );

  // UpdateUserProfileDto-ya tam uyğun payload. dateOfBirth əvəzinə birthday,
  // telefon/e-poçt məlumatları üçün isə contactInfos göndərilir.
  return cleanObject({
    firstName: getPayloadString(payload, 'firstName'),
    lastName: getPayloadString(payload, 'lastName'),
    middleName: getPayloadString(payload, 'middleName'),
    jobTitle: getPayloadString(payload, 'jobTitle'),
    phone1: getPayloadString(payload, 'phone1'),
    phone2: getPayloadString(payload, 'phone2'),
    whatsappPhone: getPayloadString(payload, 'whatsappPhone') || getPayloadString(payload, 'whatsapp'),
    extensionNumber: getPayloadString(payload, 'extensionNumber') || getPayloadString(payload, 'internalNumber'),
    additionalInfo,
    photoUrl,
    googleMapsUrl: getPayloadString(payload, 'googleMapsUrl'),
    cardBackgroundUrl: backendCardBackgroundValue(getPayloadString(payload, 'cardBackgroundUrl')),
    address: getPayloadString(payload, 'address') || getPayloadString(payload, 'homeAddress'),
    birthday: getPayloadString(payload, 'dateOfBirth') || getPayloadString(payload, 'birthDate') || getPayloadString(payload, 'birthday'),
    linkedinUrl: socials.linkedinUrl,
    facebookUrl: socials.facebookUrl,
    instagramUrl: socials.instagramUrl,
    socialAccounts: normalizeCustomSocialAccounts(payload.socialAccounts),
    contactInfos: contactInfos.length > 0 ? contactInfos : undefined,
  });
};

export const buildBaseUserPayload = (
  payload: AddUserPayload,
  companyId: string
) => {
  return cleanObject({
    companyId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    middleName: payload.middleName,
    jobTitle: payload.jobTitle,
    phone1: payload.phone1,
    phone2: payload.phone2,
    whatsapp: payload.whatsapp,
    whatsappPhone: payload.whatsapp,
    extensionNumber: payload.extensionNumber,
    internalNumber: payload.extensionNumber,
    email: payload.email,
    gmail: payload.email,
    userEmail: payload.email,
    password: payload.password,
    code: payload.password,
    role: payload.role ?? 0,
    isActive: payload.isActive ?? true,
    canEdit: payload.canEdit ?? true,
    canEditProfile: payload.canEdit ?? true,
    linkedin: payload.linkedin,
    linkedInUrl: payload.linkedin,
    linkedinUrl: payload.linkedin,
    facebook: payload.facebook,
    facebookUrl: payload.facebook,
    instagram: payload.instagram,
    instagramUrl: payload.instagram,
    additionalInfo: payload.additionalInfo,
    dateOfBirth: payload.dateOfBirth,
    birthday: payload.dateOfBirth,
    address: payload.address,
    googleMapsUrl: payload.googleMapsUrl,
    cardBackgroundUrl: payload.cardBackgroundUrl,
    socialAccounts: normalizeCustomSocialAccounts(payload.socialAccounts),
    photo: payload.photo,
    photoUrl: payload.photoUrl || payload.photo,
  });
};

export const buildUpdateUserPayload = (payload: UpdateUserPayload) => {
  return cleanObject({
    firstName: payload.firstName,
    lastName: payload.lastName,
    middleName: payload.middleName,
    jobTitle: payload.jobTitle,
    phone1: payload.phone1,
    phone2: payload.phone2,
    whatsapp: payload.whatsapp,
    whatsappPhone: payload.whatsapp,
    extensionNumber: payload.extensionNumber,
    additionalInfo: payload.additionalInfo,
    dateOfBirth: payload.dateOfBirth,
    birthday: payload.dateOfBirth,
    address: payload.address,
    googleMapsUrl: payload.googleMapsUrl,
    cardBackgroundUrl: payload.cardBackgroundUrl,
    photoUrl: payload.photoUrl || payload.photo,
    linkedin: payload.linkedin,
    linkedInUrl: payload.linkedin,
    linkedinUrl: payload.linkedin,
    facebook: payload.facebook,
    facebookUrl: payload.facebook,
    instagram: payload.instagram,
    instagramUrl: payload.instagram,
    socialAccounts: normalizeCustomSocialAccounts(payload.socialAccounts),
  });
};

export const photoResponseKeys = [
  'photoUrl',
  'photoURL',
  'profilePhotoUrl',
  'profilePhotoURL',
  'employeePhotoUrl',
  'userPhotoUrl',
  'avatarUrl',
  'imageUrl',
  'pictureUrl',
  'photoPath',
  'imagePath',
  'filePath',
  'photo',
  'profilePhoto',
  'employeePhoto',
  'userPhoto',
  'avatar',
  'image',
  'picture',
] as const;

export const getUploadedPhotoUrl = (responseData: unknown) => {
  if (!isRecord(responseData)) return '';
  return normalizeAssetUrl(findStringDeep(responseData, [...photoResponseKeys]));
};

const getExactStringDeep = (value: unknown, keys: string[]): string => {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) continue;

    for (const [key, nestedValue] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        const text = String(nestedValue ?? '').trim();
        if (text) return text;
      }
    }

    for (const nestedValue of Object.values(current)) {
      if (isRecord(nestedValue) || Array.isArray(nestedValue)) queue.push(nestedValue);
    }
  }

  return '';
};

const allowedPhotoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif']);

const photoMimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

const safePhotoBaseName = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim() || 'employee-photo';
  return withoutExtension.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'employee-photo';
};

const createCanvasPhotoBlob = (
  canvas: HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/png',
  quality?: number,
) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Şəkli uyğun formata çevirmək mümkün olmadı.'));
  }, mimeType, quality);
});

const convertPhotoToJpeg = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Seçilmiş şəkil brauzer tərəfindən oxunmadı. JPG, PNG və ya GIF seçin.'));
      element.src = objectUrl;
    });

    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;

    if (!originalWidth || !originalHeight) {
      throw new Error('Şəklin ölçülərini müəyyən etmək mümkün olmadı.');
    }

    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Şəkli emal etmək mümkün olmadı.');

    // JPEG şəffaf fon saxlamadığı üçün şəffaf sahələri ağ fonla doldururuq.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await createCanvasPhotoBlob(canvas, 'image/jpeg', 0.9);
    return new File([blob], `${safePhotoBaseName(file.name)}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const normalizeEmployeePhotoUploadFile = async (file: File): Promise<File> => {
  const mimeType = String(file.type || '').toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const inferredMimeType = photoMimeByExtension[extension];
  const acceptedMimeType = allowedPhotoMimeTypes.has(mimeType)
    ? mimeType
    : (!mimeType || mimeType === 'application/octet-stream' ? inferredMimeType : undefined);

  if (acceptedMimeType && allowedPhotoMimeTypes.has(acceptedMimeType)) {
    const normalizedExtension = acceptedMimeType === 'image/jpeg'
      ? 'jpg'
      : acceptedMimeType.split('/')[1];

    return new File([file], `${safePhotoBaseName(file.name)}.${normalizedExtension}`, {
      type: acceptedMimeType,
      lastModified: file.lastModified,
    });
  }

  // WEBP, BMP və brauzerin aça bildiyi digər şəkillər backendin qəbul etdiyi
  // JPG formatına çevrilir. Beləliklə endpointə image/webp və ya application/octet-stream getmir.
  return convertPhotoToJpeg(file);
};

const uploadCompanyAdminEmployeePhoto = async (userId: string, file: File) => {
  const normalizedFile = await normalizeEmployeePhotoUploadFile(file);
  const formData = new FormData();
  formData.append('file', normalizedFile, normalizedFile.name);

  const response = await axiosInstance.post(
    `/api/CompanyAdmin/users/${encodeURIComponent(userId)}/photo`,
    formData,
  );

  const photoUrl = getUploadedPhotoUrl(response.data);

  return {
    ...(response.data && typeof response.data === 'object' ? response.data : {}),
    photoUrl,
    photo: photoUrl,
  };
};

const findCreatedEmployeeIdOnce = async (
  responseData: unknown,
  payload: Record<string, unknown>,
) => {
  // Əvvəlcə konkret employee identifikatorlarını axtarırıq. Dərin obyektlərdəki
  // istənilən "id" companyId ola bildiyi üçün generic id yalnız top-level-də oxunur.
  const directEmployeeId = getExactStringDeep(responseData, ['userId', 'employeeId', 'cardId']);
  if (directEmployeeId) return directEmployeeId;

  if (isRecord(responseData)) {
    const topLevelId = String(responseData.id ?? '').trim();
    if (topLevelId) return topLevelId;
  }

  const companyId = getPayloadString(payload, 'companyId');
  const email = (getPayloadString(payload, 'email') || getPayloadString(payload, 'gmail')).toLowerCase();
  if (!companyId || !email) return '';

  try {
    const response = await axiosInstance.get(
      `/api/CompanyAdmin/users/company/${encodeURIComponent(companyId)}`,
      { params: { page: 1, pageSize: 1000 } },
    );

    const queue: unknown[] = [response.data];
    const seen = new Set<unknown>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      if (!isRecord(current)) continue;

      const rowEmail = String(
        current.email ?? current.gmail ?? current.userEmail ?? current.emailAddress ?? '',
      ).trim().toLowerCase();

      if (rowEmail === email) {
        const rowId = String(
          current.userId ?? current.employeeId ?? current.cardId ?? current.id ?? '',
        ).trim();
        if (rowId) return rowId;
      }

      for (const nestedValue of Object.values(current)) {
        if (isRecord(nestedValue) || Array.isArray(nestedValue)) queue.push(nestedValue);
      }
    }
  } catch {
    // İşçi yaradılması uğurlu qalıb; siyahıdan ID tapılmasa foto yükləməsi ayrıca buraxılır.
  }

  return '';
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

const resolveCreatedEmployeeId = async (
  responseData: unknown,
  payload: Record<string, unknown>,
) => {
  const immediateId = await findCreatedEmployeeIdOnce(responseData, payload);
  if (immediateId) return immediateId;

  // Backend create-dən dərhal sonra siyahını gec yeniləyə bilər. Foto və canEdit
  // əməliyyatları üçün qısa retry edirik, amma əsas işçi yaradılmasını uğursuz saymırıq.
  for (const delay of [200, 400, 700]) {
    await wait(delay);
    const id = await findCreatedEmployeeIdOnce(undefined, payload);
    if (id) return id;
  }

  return '';
};

const updateCreatedEmployeeCanEdit = async (userId: string, canEdit: unknown) => {
  if (typeof canEdit !== 'boolean') return;

  await axiosInstance.put(
    `/api/CompanyAdmin/users/${encodeURIComponent(userId)}/canedit`,
    undefined,
    { params: { canEdit } },
  );
};

const persistCreatedEmployeeProfile = async (
  userId: string,
  payload: Record<string, unknown>,
) => {
  const profilePayload = buildSwaggerUpdateUserPayload(payload);
  const response = await axiosInstance.put(
    `/api/CompanyAdmin/users/${encodeURIComponent(userId)}`,
    profilePayload,
  );

  return response.data && typeof response.data === 'object'
    ? response.data as Record<string, unknown>
    : {};
};

const withCardBackgroundFromFile = async (payload: Record<string, unknown>, file?: File) => {
  if (!file) return payload;

  const cardBackgroundUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Arxa fon faylı oxunmadı'));
    reader.readAsDataURL(file);
  });

  return { ...payload, cardBackgroundUrl };
};

export const postUserWithOptionalPhoto = async (payload: Record<string, unknown>, file?: File, backgroundFile?: File) => {
  const jsonPayload = await withCardBackgroundFromFile(payload, backgroundFile);
  const swaggerPayload = buildSwaggerCreateUserPayload(jsonPayload);
  const response = await axiosInstance.post('/api/CompanyAdmin/users', swaggerPayload);
  const responseRecord = response.data && typeof response.data === 'object' ? response.data : {};
  const createdUserId = await resolveCreatedEmployeeId(response.data, payload);

  let persistedProfile: Record<string, unknown> = {};
  let uploadedPhoto: Record<string, unknown> = {};
  let profileUpdateFailed = false;
  let photoUploadFailed = false;
  let canEditUpdateFailed = false;

  // POST-dan sonra bütün profil sahələrini PUT ilə də təsdiqləyirik. Bəzi backend
  // versiyaları create zamanı optional sahələri qəbul etsə də bazaya tam yazmır və
  // növbəti GET/refresh zamanı həmin məlumatlar boş görünür.
  if (createdUserId) {
    try {
      persistedProfile = await persistCreatedEmployeeProfile(createdUserId, payload);
    } catch {
      profileUpdateFailed = true;
    }
  } else {
    profileUpdateFailed = true;
  }

  // İşçi artıq yaradılıbsa sonrakı profil/foto/canEdit sorğusunun xətası əsas
  // create əməliyyatını geri çevirməməlidir.
  if (file && createdUserId) {
    try {
      uploadedPhoto = await uploadCompanyAdminEmployeePhoto(createdUserId, file);
    } catch {
      photoUploadFailed = true;
    }
  } else if (file) {
    photoUploadFailed = true;
  }

  if (createdUserId) {
    try {
      await updateCreatedEmployeeCanEdit(createdUserId, payload.canEdit);
    } catch {
      canEditUpdateFailed = true;
    }
  } else if (typeof payload.canEdit === 'boolean') {
    canEditUpdateFailed = true;
  }

  const photoUrl = getUploadedPhotoUrl(uploadedPhoto)
    || findStringDeep(persistedProfile, [...photoResponseKeys])
    || findStringDeep(response.data, [...photoResponseKeys]);

  return {
    ...responseRecord,
    ...persistedProfile,
    ...uploadedPhoto,
    ...(createdUserId ? { id: createdUserId } : {}),
    photoUrl,
    photo: photoUrl,
    cardBackgroundUrl: findStringDeep(
      [persistedProfile, response.data],
      ['cardBackgroundUrl', 'backgroundUrl'],
    ),
    ...(profileUpdateFailed ? { profileUpdateFailed: true } : {}),
    ...(photoUploadFailed ? { photoUploadFailed: true } : {}),
    ...(canEditUpdateFailed ? { canEditUpdateFailed: true } : {}),
  };
};

export const putUserWithOptionalPhoto = async (userId: string, payload: Record<string, unknown>, file?: File, backgroundFile?: File) => {
  const jsonPayload = await withCardBackgroundFromFile(payload, backgroundFile);
  const swaggerPayload = buildSwaggerUpdateUserPayload(jsonPayload);
  const profileRequest = axiosInstance.put(
    `/api/CompanyAdmin/users/${encodeURIComponent(userId)}`,
    swaggerPayload,
  );
  const photoRequest = file
    ? uploadCompanyAdminEmployeePhoto(userId, file)
    : Promise.resolve<Record<string, unknown>>({});

  // Mətn məlumatları və foto bir-birini gözləmədən paralel göndərilir.
  // Beləliklə modalın "Yadda saxla" prosesi yalnız ən gec sorğu qədər çəkir.
  const [profileResult, photoResult] = await Promise.allSettled([profileRequest, photoRequest]);

  if (profileResult.status === 'rejected') throw profileResult.reason;

  const response = profileResult.value;
  const uploadedPhoto = photoResult.status === 'fulfilled' ? photoResult.value : {};
  const photoUploadFailed = photoResult.status === 'rejected';

  const photoUrl = getUploadedPhotoUrl(uploadedPhoto)
    || swaggerPayload.photoUrl
    || findStringDeep(response.data, [...photoResponseKeys]);

  return {
    ...(response.data && typeof response.data === 'object' ? response.data : {}),
    ...uploadedPhoto,
    photoUrl,
    photo: photoUrl,
    cardBackgroundUrl: swaggerPayload.cardBackgroundUrl || findStringDeep(response.data, ['cardBackgroundUrl', 'backgroundUrl']),
    ...(photoUploadFailed ? { photoUploadFailed: true } : {}),
  };
};
