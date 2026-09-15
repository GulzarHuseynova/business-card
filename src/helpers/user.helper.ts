import axios from 'axios';
import { userService } from '../services/user.service';
import {addLocalAuditLog,applyLocalEmployeeOverrideToRecord,employeeToRecord,findLocalEmployeeById,findLocalEmployeeOverride,saveLocalEmployeeOverride,updateLocalEmployeeById,type LocalEmployeeAccount,} from '../storage/local-auth/employee-local-auth';
import { getStoredUser, isLocalEmployeeToken, patchStoredUser } from '../storage/auth.storage';
import { getSavedCompanyId, getSavedCompanyVoen } from '../storage/company.storage';
import { asBoolean, findDeep, findObjectDeep, findStringDeep, isRecord, unwrapData } from '../utils/api.utils';
import { normalizeAssetUrl } from '../utils/asset-url.utils';
import { getEmployeePhotoFromRecord, pickPublicCardPhoto } from '../features/public-card/public-card-shared';

const isLocalEmployeeSession = () => isLocalEmployeeToken();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_MAX_INPUT_BYTES = 12 * 1024 * 1024;
const PROFILE_IMAGE_MAX_DIMENSION = 1400;

const extractApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const data = error.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const direct = [record.message, record.detail, record.title, record.error]
      .find((value) => typeof value === 'string' && value.trim());
    if (typeof direct === 'string') return direct.trim();

    const errors = record.errors;
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .find((value) => typeof value === 'string' && value.trim());
      if (typeof first === 'string') return first.trim();
    }
  }

  return fallback;
};

const loadImageFromFile = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Şəkil faylı oxunmadı. JPG və ya PNG faylı seçin.'));
  };
  image.src = objectUrl;
});

const prepareProfilePhotoFile = async (file: File) => {
  if (!PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Profil şəkli JPG, PNG və ya WEBP formatında olmalıdır.');
  }

  if (file.size > PROFILE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error('Profil şəkli 12 MB-dan böyük ola bilməz.');
  }

  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > PROFILE_IMAGE_MAX_DIMENSION
    ? PROFILE_IMAGE_MAX_DIMENSION / longestSide
    : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Şəkil emal edilə bilmədi.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.88);
  });

  if (!blob) throw new Error('Profil şəkli hazırlanmadı. Başqa şəkil seçin.');

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-') || 'profile-photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const isUsefulBackendUserId = (value: unknown) => {
  const id = normalizeString(value);
  if (!UUID_PATTERN.test(id)) return false;

  const stored = getStoredUser();
  const accountInfo = getStoredAccountInfo();
  const companyIds = [
    getSavedCompanyId(),
    normalizeString(stored?.companyId),
    normalizeString(accountInfo.companyId),
    normalizeString(accountInfo.companyID),
    normalizeString(accountInfo.company_id),
  ].filter(Boolean);

  if (companyIds.includes(id)) return false;

  return true;
};

const getStoredAccountInfo = () => toRecord(getStoredUser()?.accountInfo);

const getUserLookupCandidates = (requestedId: string) => {
  const stored = getStoredUser();
  const accountInfo = getStoredAccountInfo();

  return unique([
    normalizeString(requestedId),
    normalizeString(stored?.userId),
    normalizeString(stored?.id),
    normalizeString(accountInfo.userId),
    normalizeString(accountInfo.employeeId),
    normalizeString(accountInfo.cardId),
    normalizeString(accountInfo.profileId),
    normalizeString(accountInfo.id),
  ]).filter(isUsefulBackendUserId);
};

const buildStoredEmployeeFallback = (requestedId: string) => {
  const stored = getStoredUser();
  const accountInfo = getStoredAccountInfo();
  const email = usefulText(stored?.email, accountInfo.email, accountInfo.email1, accountInfo.gmail, accountInfo.mail);
  const localEmployee = findLocalEmployeeById(requestedId) || findLocalEmployeeById(email) || findLocalEmployeeById(stored?.userId || '') || findLocalEmployeeById(stored?.id || '');
  const base = localEmployee ? employeeToRecord(localEmployee) : accountInfo;

  if (Object.keys(base).length === 0 && !email) return null;

  return mergeBackendEmployeeWithLocal({
    ...base,
    id: usefulText(base.id, base.userId, base.employeeId, requestedId, stored?.userId, stored?.id, email),
    email,
    companyId: usefulText(base.companyId, getSavedCompanyId()),
    companyVoen: usefulText(base.companyVoen, base.voen, getSavedCompanyVoen()),
  });
};

const stringifyAuditValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};


const normalizeString = (value: unknown) => String(value ?? '').trim();

const INVALID_PROFILE_TEXTS = new Set([
  '', '-', '--', 'null', 'undefined', 'string', '[object object]',
  'n/a', 'na', 'yoxdur', 'yox',
]);

const cleanProfileText = (value: unknown) => {
  const text = normalizeString(value);
  return INVALID_PROFILE_TEXTS.has(text.toLowerCase()) ? '' : text;
};

const usefulText = (...values: unknown[]) => {
  for (const value of values) {
    const text = cleanProfileText(value);
    if (text) return text;
  }

  return '';
};

const normalizeProfileUrl = (value: unknown) => {
  const text = cleanProfileText(value);
  if (!text) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) return text;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(text)) return `https://${text}`;
  return '';
};

const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const extractEmployeeRecord = (payload: unknown): Record<string, unknown> => {
  const root = unwrapData(payload);
  if (!isRecord(root)) return {};

  const nested = ['user', 'profile', 'employee', 'card', 'accountInfo']
    .map((key) => root[key])
    .find(isRecord) || findObjectDeep(root, ['user', 'profile', 'employee', 'card', 'accountInfo']);

  return nested ? {
    ...root,
    ...nested,
    company: nested.company || root.company,
  } : root;
};

const readPermission = (source: unknown): boolean | undefined => {
  const raw = findDeep(source, ['canEdit', 'canEditProfile', 'canedit', 'canUpdate', 'editPermission', 'editable']);
  if (raw === undefined || raw === null || raw === '') return undefined;
  return asBoolean(raw, true);
};

const firstList = (...values: unknown[]) => values.find(hasItems) || [];

const pickEmployeePhoto = (...values: unknown[]) => pickPublicCardPhoto(...values);

const mergeBackendEmployeeWithLocal = (backendPayload: Record<string, unknown>) => {
  const backendRow = extractEmployeeRecord(backendPayload);
  const email = usefulText(backendRow.email, backendRow.email1, backendRow.gmail, backendRow.mail, backendRow.emailAddress);
  const backendId = usefulText(backendRow.id, backendRow.userId, backendRow.employeeId, backendRow.cardId);
  const localEmployee = (email ? findLocalEmployeeById(email) : null) || (backendId ? findLocalEmployeeById(backendId) : null);
  const localRow = localEmployee ? employeeToRecord(localEmployee) : {};
  const sessionRow = extractEmployeeRecord(getStoredUser()?.accountInfo);
  const companyId = usefulText(backendRow.companyId, localRow.companyId, sessionRow.companyId, getSavedCompanyId());
  const companyVoen = usefulText(backendRow.companyVoen, backendRow.voen, localRow.companyVoen, localRow.voen, sessionRow.companyVoen, sessionRow.voen, getSavedCompanyVoen());
  const localOverride = findLocalEmployeeOverride({
    id: backendId || usefulText(localRow.id, sessionRow.id),
    email: email || usefulText(localRow.email, sessionRow.email),
    companyId,
    companyVoen,
  });
  const canEdit = localOverride?.canEdit ?? readPermission(backendRow) ?? readPermission(localRow) ?? readPermission(sessionRow) ?? true;
  const preferredPhoto = pickEmployeePhoto(
    localOverride?.photoUrl,
    localOverride?.photo,
    localRow.photoUrl,
    localRow.photo,
    sessionRow.photoUrl,
    sessionRow.photo,
    getEmployeePhotoFromRecord(backendRow),
    backendRow.photoUrl,
    backendRow.photo,
    backendRow.photoData,
    backendRow.avatarUrl,
    backendRow.avatar,
  );

  return {
    ...sessionRow,
    ...localRow,
    ...backendRow,
    id: usefulText(backendRow.id, backendRow.userId, backendRow.employeeId, localRow.id, localRow.userId, sessionRow.id, sessionRow.userId),
    userId: usefulText(backendRow.userId, backendRow.id, backendRow.employeeId, localRow.userId, localRow.id, sessionRow.userId, sessionRow.id),
    companyId,
    companyVoen,
    voen: usefulText(backendRow.voen, backendRow.companyVoen, localRow.voen, localRow.companyVoen, sessionRow.voen, sessionRow.companyVoen, companyVoen),
    companyName: usefulText(backendRow.companyName, findStringDeep(backendRow.company, ['name', 'companyName']), localRow.companyName, sessionRow.companyName),
    firstName: usefulText(backendRow.firstName, backendRow.givenName, localRow.firstName, sessionRow.firstName),
    lastName: usefulText(backendRow.lastName, backendRow.surname, localRow.lastName, sessionRow.lastName),
    middleName: usefulText(backendRow.middleName, backendRow.fatherName, localRow.middleName, sessionRow.middleName),
    jobTitle: usefulText(backendRow.jobTitle, backendRow.position, backendRow.title, localRow.jobTitle, localRow.position, sessionRow.jobTitle, sessionRow.position),
    position: usefulText(backendRow.position, backendRow.jobTitle, backendRow.title, localRow.position, localRow.jobTitle, sessionRow.position, sessionRow.jobTitle),
    email: usefulText(backendRow.email, backendRow.email1, backendRow.gmail, backendRow.mail, localRow.email, sessionRow.email, sessionRow.gmail),
    phone1: usefulText(backendRow.phone1, backendRow.phone, backendRow.phoneNumber, localRow.phone1, sessionRow.phone1),
    phone2: usefulText(backendRow.phone2, backendRow.secondaryPhone, localRow.phone2, sessionRow.phone2),
    whatsapp: usefulText(backendRow.whatsapp, backendRow.whatsappPhone, localRow.whatsapp, sessionRow.whatsapp, sessionRow.whatsappPhone),
    whatsappPhone: usefulText(backendRow.whatsappPhone, backendRow.whatsapp, localRow.whatsappPhone, localRow.whatsapp, sessionRow.whatsappPhone, sessionRow.whatsapp),
    extensionNumber: usefulText(backendRow.extensionNumber, backendRow.internalNumber, localRow.extensionNumber, sessionRow.extensionNumber),
    internalNumber: usefulText(backendRow.internalNumber, backendRow.extensionNumber, localRow.internalNumber, localRow.extensionNumber, sessionRow.internalNumber, sessionRow.extensionNumber),
    linkedin: usefulText(backendRow.linkedin, backendRow.linkedInUrl, backendRow.linkedinUrl, localRow.linkedin, localRow.linkedInUrl, localRow.linkedinUrl, sessionRow.linkedin, sessionRow.linkedInUrl, sessionRow.linkedinUrl),
    linkedInUrl: usefulText(backendRow.linkedInUrl, backendRow.linkedinUrl, backendRow.linkedin, localRow.linkedInUrl, localRow.linkedinUrl, localRow.linkedin, sessionRow.linkedInUrl, sessionRow.linkedinUrl, sessionRow.linkedin),
    linkedinUrl: usefulText(backendRow.linkedinUrl, backendRow.linkedInUrl, backendRow.linkedin, localRow.linkedinUrl, localRow.linkedInUrl, localRow.linkedin, sessionRow.linkedinUrl, sessionRow.linkedInUrl, sessionRow.linkedin),
    facebook: usefulText(backendRow.facebook, backendRow.facebookUrl, localRow.facebook, localRow.facebookUrl, sessionRow.facebook, sessionRow.facebookUrl),
    facebookUrl: usefulText(backendRow.facebookUrl, backendRow.facebook, localRow.facebookUrl, localRow.facebook, sessionRow.facebookUrl, sessionRow.facebook),
    instagram: usefulText(backendRow.instagram, backendRow.instagramUrl, localRow.instagram, localRow.instagramUrl, sessionRow.instagram, sessionRow.instagramUrl),
    instagramUrl: usefulText(backendRow.instagramUrl, backendRow.instagram, localRow.instagramUrl, localRow.instagram, sessionRow.instagramUrl, sessionRow.instagram),
    socialAccounts: firstList(backendRow.socialAccounts, localRow.socialAccounts, sessionRow.socialAccounts),
    socials: firstList(backendRow.socials, localRow.socials, sessionRow.socials),
    photo: preferredPhoto,
    photoUrl: preferredPhoto,
    cardBackground: usefulText(backendRow.cardBackground, backendRow.cardBackgroundUrl, localRow.cardBackground, localRow.cardBackgroundUrl, sessionRow.cardBackground, sessionRow.cardBackgroundUrl),
    cardBackgroundUrl: usefulText(backendRow.cardBackgroundUrl, backendRow.cardBackground, localRow.cardBackgroundUrl, localRow.cardBackground, sessionRow.cardBackgroundUrl, sessionRow.cardBackground),
    canEdit,
    canEditProfile: canEdit,
    canUpdate: canEdit,
    editPermission: canEdit,
    editable: canEdit,
  };
};

const pickListItem = (items: Array<Record<string, unknown>>, key: string, wanted: string[]) => {
  const normalizedWanted = wanted.map((item) => item.toLowerCase());
  return items.find((item) => {
    const value = normalizeString(item[key]).toLowerCase();
    return normalizedWanted.some((wantedValue) => value.includes(wantedValue));
  });
};

const socialExtraPattern = /(linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com|telegram|sosial|social)/i;
const socialExtraUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:linkedin|facebook|instagram|youtube|tiktok|twitter|x)\.com\//i;

const cleanVisibleAdditionalInfo = (value: unknown) => {
  const text = cleanProfileText(value);
  if (!text) return '';

  return text
    .split(/[;\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const separatorIndex = part.indexOf(':');
      const rawLabel = separatorIndex >= 0 ? part.slice(0, separatorIndex).trim() : '';
      return !(socialExtraPattern.test(rawLabel) || socialExtraUrlPattern.test(part));
    })
    .join('; ');
};

const buildAdditionalInfo = (record: Record<string, unknown>) => {
  const extras = Array.isArray(record.extras) ? record.extras as Array<Record<string, unknown>> : [];

  // Sosial linklər ayrıca sosial sahələrdə saxlanılır. Onları additionalInfo daxilinə
  // yenidən yazmırıq ki, public kartda "Əlavə məlumat" kimi təkrarlanmasın.
  return extras
    .filter((item) => {
      const label = normalizeString(item.label);
      const value = normalizeString(item.value);
      return (
        label.toLowerCase() !== 'email' &&
        !socialExtraPattern.test(label) &&
        !socialExtraUrlPattern.test(value)
      );
    })
    .map((item) => [normalizeString(item.label), normalizeString(item.value)].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('; ');
};

const findSocialUrl = (record: Record<string, unknown>, name: string) => {
  const socials = Array.isArray(record.socials) ? record.socials as Array<Record<string, unknown>> : [];
  const item = socials.find((social) => {
    const platform = normalizeString(social.platform || social.platformName || social.type || social.name).toLowerCase();
    return platform.includes(name);
  });

  return normalizeString(item?.url || item?.link || item?.value || item?.href);
};

const cleanProfileDto = (dto: Record<string, unknown>) => Object.fromEntries(
  Object.entries(dto).filter(([, value]) => {
    if (Array.isArray(value)) return true;
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return Boolean(cleanProfileText(value));
    return true;
  })
);

const asBackendPhotoUrl = (value: unknown) => {
  const text = cleanProfileText(value);
  // /api/User/profile/photo multipart endpoint-i var. PUT /api/User/profile-ə base64 göndərmirik.
  if (/^https?:\/\//i.test(text)) return text;
  return '';
};

const buildUpdateUserProfileDto = (payload: unknown) => {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const phones = Array.isArray(record.phones) ? record.phones as Array<Record<string, unknown>> : [];

  const workPhone = pickListItem(phones, 'type', ['iş', 'is', 'work']) || phones[0];
  const personalPhone = pickListItem(phones, 'type', ['şəxsi', 'sexsi', 'personal']) || phones[1];
  const whatsappPhone = pickListItem(phones, 'type', ['whatsapp', 'wp']);
  const photoUrl = asBackendPhotoUrl(record.photoUrl || record.photo);
  const cardBackgroundUrl = asBackendPhotoUrl(record.cardBackgroundUrl || record.cardBackground);

  // OpenAPI UpdateUserProfileDto-da yalnız bu field-lər var.
  // Boş string göndərmirik: bəzi backend validasiyaları boş field-lərə 400 qaytarır.
  const socialAccounts = Array.isArray(record.socialAccounts)
    ? (record.socialAccounts as Array<Record<string, unknown>>)
      .map((item) => {
        const platformName = cleanProfileText(item.platformName || item.platform || item.name || item.type);
        const profileUrl = normalizeProfileUrl(item.profileUrl || item.url || item.link || item.value);
        const iconUrl = asBackendPhotoUrl(item.iconUrl || item.icon || item.imageUrl);

        return cleanProfileDto({ platformName, profileUrl, iconUrl });
      })
      .filter((item) => item.platformName && item.profileUrl)
    : undefined;

  const storedAccountInfo = getStoredAccountInfo();
  const requiredPhone1 = usefulText(
    workPhone?.number,
    record.phone1,
    record.phone,
    record.phoneNumber,
    storedAccountInfo.phone1,
    storedAccountInfo.phone,
    storedAccountInfo.phoneNumber,
  );

  const dto = cleanProfileDto({
    firstName: cleanProfileText(record.firstName),
    lastName: cleanProfileText(record.lastName),
    middleName: cleanProfileText(record.middleName),
    jobTitle: cleanProfileText(record.jobTitle || record.position),
    phone1: requiredPhone1,
    phone2: cleanProfileText(personalPhone?.number || record.phone2),
    whatsappPhone: cleanProfileText(whatsappPhone?.number || record.whatsappPhone || record.whatsapp),
    extensionNumber: cleanProfileText(record.extensionNumber || record.internalNumber),
    additionalInfo: cleanVisibleAdditionalInfo(record.additionalInfo) || buildAdditionalInfo(record),
    photoUrl,
    cardBackgroundUrl,
    googleMapsUrl: normalizeProfileUrl(record.googleMapsUrl || record.mapsUrl || record.mapUrl),
    linkedinUrl: normalizeProfileUrl(record.linkedinUrl || record.linkedInUrl || record.linkedin) || normalizeProfileUrl(findSocialUrl(record, 'linkedin')),
    facebookUrl: normalizeProfileUrl(record.facebookUrl || record.facebook) || normalizeProfileUrl(findSocialUrl(record, 'facebook')),
    instagramUrl: normalizeProfileUrl(record.instagramUrl || record.instagram) || normalizeProfileUrl(findSocialUrl(record, 'instagram')),
    socialAccounts: Array.isArray(record.socialAccounts) ? socialAccounts : undefined,
  });

  return dto;
};

const patchStoredEmployeeAccountInfo = (
  userId: string,
  patch: Partial<LocalEmployeeAccount>,
  responseData?: unknown,
) => {
  const current = getStoredUser();
  const currentInfo = current?.accountInfo && typeof current.accountInfo === 'object'
    ? current.accountInfo
    : {};
  const response = responseData && typeof responseData === 'object' ? responseData as Record<string, unknown> : {};

  patchStoredUser({
    firstName: patch.firstName || current?.firstName,
    lastName: patch.lastName || current?.lastName,
    fullName: [patch.firstName || current?.firstName, patch.lastName || current?.lastName].filter(Boolean).join(' ').trim() || current?.fullName,
    accountInfo: {
      ...currentInfo,
      ...response,
      id: response.id || currentInfo.id || userId,
      userId: response.userId || currentInfo.userId || userId,
      employeeId: response.employeeId || currentInfo.employeeId || userId,
      firstName: patch.firstName || response.firstName || currentInfo.firstName,
      lastName: patch.lastName || response.lastName || currentInfo.lastName,
      middleName: patch.middleName || response.middleName || currentInfo.middleName,
      jobTitle: patch.jobTitle || response.jobTitle || currentInfo.jobTitle,
      phone1: patch.phone1 || response.phone1 || currentInfo.phone1,
      phone2: patch.phone2 || response.phone2 || currentInfo.phone2,
      whatsapp: patch.whatsapp || response.whatsapp || response.whatsappPhone || currentInfo.whatsapp,
      whatsappPhone: patch.whatsapp || response.whatsappPhone || response.whatsapp || currentInfo.whatsappPhone,
      extensionNumber: patch.extensionNumber || response.extensionNumber || currentInfo.extensionNumber,
      linkedin: patch.linkedin || currentInfo.linkedin,
      facebook: patch.facebook || currentInfo.facebook,
      instagram: patch.instagram || currentInfo.instagram,
      photo: patch.photo || response.photo || currentInfo.photo,
      photoUrl: patch.photoUrl || response.photoUrl || response.photo || currentInfo.photoUrl,
      cardBackground: patch.cardBackground || patch.cardBackgroundUrl || response.cardBackground || response.cardBackgroundUrl || currentInfo.cardBackground,
      cardBackgroundUrl: patch.cardBackgroundUrl || patch.cardBackground || response.cardBackgroundUrl || response.cardBackground || currentInfo.cardBackgroundUrl,
    },
  });
};

const cardPayloadToEmployeePatch = (payload: unknown): Partial<LocalEmployeeAccount> => {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  const phones = Array.isArray(record.phones) ? record.phones as Array<Record<string, unknown>> : [];
  const socials = Array.isArray(record.socials) ? record.socials as Array<Record<string, unknown>> : [];
  const workPhone = phones.find((phone) => String(phone.type || '').toLowerCase().includes('iş')) || phones[0];
  const personalPhone = phones.find((phone) => String(phone.type || '').toLowerCase().includes('şəxsi')) || phones[1];
  const whatsapp = phones.find((phone) => String(phone.type || '').toLowerCase().includes('whatsapp'));
  const findSocial = (name: string) => socials.find((social) => String(social.platform || '').toLowerCase().includes(name));

  return {
    firstName: String(record.firstName || ''),
    lastName: String(record.lastName || ''),
    middleName: String(record.middleName || ''),
    jobTitle: String(record.position || record.jobTitle || ''),
    phone1: String(workPhone?.number || ''),
    phone2: String(personalPhone?.number || ''),
    whatsapp: String(whatsapp?.number || ''),
    extensionNumber: String(record.internalNumber || ''),
    linkedin: String(findSocial('linkedin')?.url || ''),
    facebook: String(findSocial('facebook')?.url || ''),
    instagram: String(findSocial('instagram')?.url || ''),
    photo: String(record.photo || record.photoUrl || ''),
    photoUrl: String(record.photoUrl || record.photo || ''),
    cardBackground: String(record.cardBackground || record.cardBackgroundUrl || ''),
    cardBackgroundUrl: String(record.cardBackgroundUrl || record.cardBackground || ''),
  };
};

const addEmployeeProfileAudit = (
  userId: string,
  beforeEmployee: LocalEmployeeAccount | null,
  afterData: unknown,
) => {
  const afterRecord = afterData && typeof afterData === 'object'
    ? afterData as Record<string, unknown>
    : {};
  const fullName = [
    afterRecord.firstName || beforeEmployee?.firstName,
    afterRecord.lastName || beforeEmployee?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  addLocalAuditLog({
    userName: fullName || beforeEmployee?.email || getStoredUser()?.email || 'Employee',
    userId: userId || beforeEmployee?.id || beforeEmployee?.email,
    actionType: 'Employee Profile Updated',
    entity: 'Employee',
    beforeValue: stringifyAuditValue(beforeEmployee ? employeeToRecord(beforeEmployee) : null),
    afterValue: stringifyAuditValue(afterData),
    details: `${fullName || beforeEmployee?.email || 'İşçi'} öz vizitkart məlumatlarını yenilədi`,
    companyId: beforeEmployee?.companyId || getSavedCompanyId() || '',
    companyVoen: beforeEmployee?.voen || getSavedCompanyVoen() || '',
  });
};

const getApiValidationMessage = (error: unknown) => {
  const maybe = error as {
    response?: { data?: unknown; status?: number };
    message?: string;
  };
  const data = maybe?.response?.data;

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const errors = record.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.entries(errors as Record<string, unknown>)
        .flatMap(([field, value]) => {
          const items = Array.isArray(value) ? value : [value];
          return items.map((item) => `${field}: ${cleanProfileText(item)}`).filter((item) => !item.endsWith(': '));
        });
      if (messages.length > 0) return messages.join(' | ');
    }

    const detail = usefulText(record.detail, record.title, record.message, record.error);
    if (detail) return detail;
  }

  return usefulText(maybe?.message);
};

const updateEmployeeProfileBackend = async (payload: unknown) => {
  const body = buildUpdateUserProfileDto(payload);

  if (!cleanProfileText(body.phone1)) {
    throw new Error('Telefon 1 mütləqdir. Telefon nömrəsini daxil edib yenidən saxlayın.');
  }

  try {
    const response = await userService.updateProfile(body);
    return response.data;
  } catch (error) {
    const detail = getApiValidationMessage(error);
    throw new Error(detail || 'Profil məlumatları server tərəfindən qəbul edilmədi.', { cause: error });
  }
};

export const userActions = {
  getOwnProfileById: async (id: string) => {
    const response = await userService.getUserById(id);
    return extractEmployeeRecord(response.data);
  },

  getUserById: async (id: string) => {
    const localEmployee = findLocalEmployeeById(id);
    const fallback = buildStoredEmployeeFallback(id);
    const candidates = getUserLookupCandidates(id);

    if (candidates.length === 0 || isLocalEmployeeSession()) {
      if (fallback) return applyLocalEmployeeOverrideToRecord(fallback, getSavedCompanyId(), getSavedCompanyVoen());
      if (localEmployee) return employeeToRecord(localEmployee);
      throw new Error('Employee məlumatı lokal sessiyada tapılmadı. Yenidən login edin.');
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await userService.getUserById(candidate);
        const row = extractEmployeeRecord(response.data);
        const mergedRow = mergeBackendEmployeeWithLocal(row);
        return applyLocalEmployeeOverrideToRecord(mergedRow, getSavedCompanyId(), getSavedCompanyVoen());
      } catch (error) {
        lastError = error;
      }
    }

    if (fallback) return applyLocalEmployeeOverrideToRecord(fallback, getSavedCompanyId(), getSavedCompanyVoen());
    if (localEmployee) return employeeToRecord(localEmployee);
    throw lastError;
  },

  updateProfile: async (payload: unknown) => {
    const userId = getStoredUser()?.userId || '';
    const beforeEmployee = userId ? findLocalEmployeeById(userId) : null;
    const patch = cardPayloadToEmployeePatch(payload);
    const overridePatch = {
      ...patch,
      id: userId || getStoredUser()?.email || '',
      email: getStoredUser()?.email || beforeEmployee?.email || '',
      companyId: beforeEmployee?.companyId || getSavedCompanyId() || '',
      companyVoen: beforeEmployee?.voen || getSavedCompanyVoen() || '',
    };

    const storedInfo = extractEmployeeRecord(getStoredUser()?.accountInfo);
    const permissionOverride = findLocalEmployeeOverride({
      id: userId || beforeEmployee?.id || '',
      email: getStoredUser()?.email || beforeEmployee?.email || usefulText(storedInfo.email, storedInfo.gmail),
      companyId: beforeEmployee?.companyId || getSavedCompanyId() || usefulText(storedInfo.companyId),
      companyVoen: beforeEmployee?.voen || getSavedCompanyVoen() || usefulText(storedInfo.companyVoen, storedInfo.voen),
    });
    const canEdit = permissionOverride?.canEdit ?? beforeEmployee?.canEdit ?? readPermission(storedInfo) ?? true;

    if (!canEdit) {
      throw new Error('Redaktə icazəniz bağlıdır. Kartı yalnız görə bilərsiniz.');
    }

    const saveLocalProfile = (responseData?: unknown) => {
      const updated = userId ? updateLocalEmployeeById(userId, patch) : null;
      const result = updated ? employeeToRecord(updated) : responseData || payload;
      saveLocalEmployeeOverride(overridePatch);
      patchStoredEmployeeAccountInfo(userId, patch, result);
      addEmployeeProfileAudit(userId, beforeEmployee, result);
      return result;
    };

    // userId companyId/e-mail/local id kimi olanda PUT /api/User/profile backenddə 400 verir.
    // Belə sessiyada səhv request atmırıq, kart məlumatını lokal override ilə qoruyuruq.
    if (isLocalEmployeeSession() || !isUsefulBackendUserId(userId)) {
      return saveLocalProfile();
    }

    const responseData = await updateEmployeeProfileBackend(payload);
    return saveLocalProfile(responseData);
  },

  updateOwnProfile: async (payload: unknown) => {
    return await updateEmployeeProfileBackend(payload);
  },

  uploadProfilePhoto: async (file: File) => {
    const preparedFile = await prepareProfilePhotoFile(file);
    const formData = new FormData();
    formData.append('file', preparedFile, preparedFile.name);

    try {
      // Content-Type-i əl ilə yazmırıq. Brauzer multipart boundary-ni özü əlavə edir.
      const response = await userService.uploadProfilePhoto(formData);
      const rawData = response.data;
      const photoUrl = normalizeAssetUrl(
        findStringDeep(rawData, [
          'photoUrl',
          'photoURL',
          'photo',
          'avatarUrl',
          'profilePhotoUrl',
          'imageUrl',
          'fileUrl',
          'url',
          'path',
        ])
      );

      return {
        ...(rawData && typeof rawData === 'object' ? rawData : {}),
        photoUrl,
      };
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, 'Profil şəkli serverə yüklənmədi.'), { cause: error });
    }
  },

  uploadCardBackground: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await userService.uploadCardBackground(formData);

    const cardBackgroundUrl = normalizeAssetUrl(
      findStringDeep(response.data, [
        'cardBackgroundUrl',
        'cardBackgroundURL',
        'cardBackground',
        'backgroundUrl',
        'backgroundImageUrl',
      ])
    );

    if (cardBackgroundUrl) {
      const current = getStoredUser();
      const currentInfo = current?.accountInfo && typeof current.accountInfo === 'object'
        ? current.accountInfo
        : {};

      patchStoredUser({
        accountInfo: {
          ...currentInfo,
          cardBackground: cardBackgroundUrl,
          cardBackgroundUrl,
        },
      });
    }

    return {
      ...(response.data && typeof response.data === 'object' ? response.data : {}),
      cardBackgroundUrl,
    };
  },

  uploadSocialIcon: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await userService.uploadSocialIcon(formData);

    const iconUrl = normalizeAssetUrl(
      findStringDeep(response.data, [
        'iconUrl',
        'socialIconUrl',
        'imageUrl',
        'url',
        'path',
      ])
    );

    return {
      ...(response.data && typeof response.data === 'object' ? response.data : {}),
      iconUrl,
    };
  },
};
