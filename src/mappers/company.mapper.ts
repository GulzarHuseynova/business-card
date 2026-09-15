import {asBoolean,asNumber,asString,extractCompanyId,findDeep,findStringDeep,isRecord,normalizeArray,normalizeRole,type AnyRecord,} from '../utils/api.utils';
import { normalizeAssetUrl, normalizeInlineImageData } from '../utils/asset-url.utils';
import { getEmployeePhotoFromRecord } from '../features/public-card/public-card-shared';
import { applyLocalEmployeeOverrideToRecord } from '../storage/local-auth/employee-local-auth';
import type { NormalizedCompanyInfo, NormalizedUser } from '../types/company.type';
import {DEFAULT_COMPANY_LOGO,cleanupCompanyLogoStorage,getSavedCompanyLimit,getSavedCompanyLogo,mapCompanyLogoResponse, pickCompanyObject,} from '../storage/company.storage';

const isEmailLike = (value: string) => /@/.test(value);

const unusableValues = new Set(['', '-', '--', 'string', 'null', 'undefined', 'n/a', 'na', 'yoxdur', 'yox']);

const cleanText = (value: unknown) => {
  const text = asString(value);
  return unusableValues.has(text.toLowerCase()) ? '' : text;
};

const pickText = (item: AnyRecord, keys: string[]) => {
  for (const key of keys) {
    const direct = cleanText(item[key]);
    if (direct) return direct;
  }

  return cleanText(findStringDeep(item, keys));
};


const pickDirectId = (item: AnyRecord, companyId: string) => {
  const id = cleanText(item.id || item.userId || item.employeeId || item.cardId || item.businessCardId || item.profileId);
  if (companyId && id === companyId) return '';
  return id;
};

const parseAdditionalInfo = (value: unknown) => {
  const result: Record<string, string> = {};
  const text = cleanText(value);
  if (!text) return result;

  text.split(/[;\n]+/).forEach((part) => {
    const [rawKey, ...rest] = part.split(':');
    const key = cleanText(rawKey).toLowerCase();
    const itemValue = cleanText(rest.join(':'));
    if (!key || !itemValue) return;

    if (key.includes('whatsapp') || key === 'wp') result.whatsapp = itemValue;
    else if (key.includes('linkedin') || key.includes('linked')) result.linkedin = itemValue;
    else if (key.includes('facebook') || key === 'fb') result.facebook = itemValue;
    else if (key.includes('instagram') || key === 'insta') result.instagram = itemValue;
    else if (key.includes('phone1') || key.includes('iş') || key.includes('is telefonu') || key.includes('work')) result.phone1 = itemValue;
    else if (key.includes('phone2') || key.includes('şəxsi') || key.includes('sexsi') || key.includes('personal')) result.phone2 = itemValue;
    else if (key.includes('daxili') || key.includes('extension') || key.includes('internal')) result.extensionNumber = itemValue;
  });

  return result;
};

const cleanVisibleAdditionalInfo = (value: unknown) => {
  const text = cleanText(value);
  if (!text) return '';

  return text
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const [rawKey] = part.split(':');
      const key = cleanText(rawKey).toLowerCase();
      return !(
        key.includes('linkedin') ||
        key.includes('facebook') ||
        key.includes('instagram') ||
        /(?:https?:\/\/)?(?:www\.)?(?:linkedin|facebook|instagram)\.com\//i.test(part)
      );
    })
    .join('; ');
};

const getSocialAccountsValue = (item: AnyRecord) => {
  return item.socialAccounts || item.socials || item.socialLinks || findDeep(item, ['socialAccounts', 'socials', 'socialLinks']);
};

const normalizeSocialAccounts = (item: AnyRecord) => {
  return normalizeArray<Record<string, unknown>>(getSocialAccountsValue(item))
    .map((account) => {
      const platform = cleanText(findStringDeep(account, [
        'platform',
        'platformName',
        'socialPlatform',
        'socialMedia',
        'socialMediaName',
        'type',
        'name',
        'label',
      ]));
      const url = cleanText(findStringDeep(account, [
        'url',
        'link',
        'value',
        'href',
        'profileUrl',
        'accountUrl',
        'socialUrl',
      ]));

      return { platform, url };
    })
    .filter((account) => account.url);
};

const primarySocialKeys = ['linkedin', 'facebook', 'instagram'];

const isPrimarySocialAccount = (platform: unknown, url: unknown) => {
  const marker = `${cleanText(platform)} ${cleanText(url)}`.toLowerCase();
  return primarySocialKeys.some((key) => marker.includes(key));
};

const pickSocialUrl = (accounts: Array<{ platform: string; url: string }>, wanted: string) => {
  const key = wanted.toLowerCase();
  return accounts.find((account) => {
    const platform = account.platform.toLowerCase();
    const url = account.url.toLowerCase();
    return platform.includes(key) || url.includes(key);
  })?.url || '';
};

const stableQrUid = (seed: string) => {
  const source = seed || crypto.randomUUID();
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const hex = (hash.toString(16).padStart(8, '0') + source.split('').map((char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    .replace(/[^a-f0-9]/gi, '')
    .padEnd(32, '0')
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const pickQrUid = (item: AnyRecord, id: string, email: string) => {
  const explicit = asString(item.qrUid || item.qrUUID || item.qrUuid || item.qrCode || item.cardUid || item.cardUuid || item.uuid);

  if (explicit && !isEmailLike(explicit)) return explicit;
  if (id && !isEmailLike(id)) return id;

  return stableQrUid(email || id || crypto.randomUUID());
};

export const mapCompanyInfo = (data: unknown): NormalizedCompanyInfo => {
  cleanupCompanyLogoStorage();
  const company = pickCompanyObject(data);
  const name = asString(company.name || company.companyName || company.title) || 'Şirkət';
  const id = extractCompanyId(company, data) || asString(company.id);
  const voen = asString(company.voen || company.companyVoen || company.taxId);
  const isActive = company.isActive === undefined ? true : asBoolean(company.isActive, true);
  const savedLimit = getSavedCompanyLimit(id, voen);
  const apiLimit = asNumber(
    company.employeeLimit || company.limit || company.userLimit || company.UserLimit || company.employeeCountLimit,
    0
  );
  const apiLogo = mapCompanyLogoResponse(company) || getSavedCompanyLogo(id, voen);
  const email = asString(company.email || company.companyEmail);
  const phone = asString(company.phone || company.contactPhone || company.mobile);

  return {
    id,
    name,
    employeeLimit: savedLimit ?? apiLimit,
    logo: apiLogo || DEFAULT_COMPANY_LOGO(name),
    industry: asString(company.industry || company.field || company.sector || company.activityArea) || '-',
    status: asString(company.status) || (isActive ? 'Aktiv' : 'Deaktiv'),
    voen,
    address: asString(company.address || company.location),
    contact: asString(company.contact || phone || email),
    email,
    phone,
    nfcBaseUrl: asString(company.nfcBaseUrl || company.nfcUrl || company.nfcLinkBase),
  };
};

export const normalizeUser = (raw: unknown): NormalizedUser => {
  const item = (isRecord(raw) ? raw : {}) as AnyRecord;
  const email = pickText(item, ['email', 'Email', 'email1', 'Email1', 'gmail', 'Gmail', 'mail', 'Mail', 'emailAddress', 'EmailAddress', 'eMail', 'userEmail', 'UserEmail', 'appUserEmail', 'AppUserEmail', 'appUser.email', 'AppUser.Email', 'loginEmail', 'LoginEmail', 'workEmail', 'WorkEmail', 'contactEmail', 'ContactEmail', 'username', 'Username', 'login', 'Login']);
  const fullName = pickText(item, ['fullName', 'name', 'userName', 'employeeName']) || email;
  const parts = fullName.split(' ').filter(Boolean);
  const companyId = cleanText(
    item.companyId || item.companyID || item.company_id || findDeep(item, ['companyId', 'companyID', 'company_id'])
  );
  const id = pickDirectId(item, companyId) || email || crypto.randomUUID();
  const firstName = pickText(item, ['firstName', 'first_name', 'name', 'ad']) || parts[0] || '-';
  const lastName = pickText(item, ['lastName', 'last_name', 'surname', 'soyad']) || parts.slice(1).join(' ');
  const middleName = pickText(item, ['middleName', 'fatherName', 'middle_name', 'ataAdi']);
  const additionalInfo = parseAdditionalInfo(item.additionalInfo || item.extraInfo || item.description || item.details);
  const socialAccounts = normalizeSocialAccounts(item);
  const customSocialAccounts = normalizeArray<Record<string, unknown>>(getSocialAccountsValue(item)).map((account) => ({
    platformName: pickText(account, ['platformName', 'platform', 'name', 'type']),
    profileUrl: pickText(account, ['profileUrl', 'url', 'link', 'value']),
    iconUrl: normalizeAssetUrl(pickText(account, ['iconUrl', 'icon', 'imageUrl'])),
  })).filter((account) => (
    (account.platformName || account.profileUrl) &&
    !isPrimarySocialAccount(account.platformName, account.profileUrl)
  ));
  const phone1 = pickText(item, ['phone1', 'phone', 'phoneNumber', 'mobile', 'workPhone', 'tel', 'telephone']) || additionalInfo.phone1 || '-';
  const photoData = normalizeInlineImageData(
    item.photoData || item.PhotoData || item.photoBase64 || item.profilePhotoData || item.profilePhotoBase64 || item.imageData || item.avatarData || item.photo,
  );
  const photoUrl = getEmployeePhotoFromRecord(item);

  return {
    id,
    firstName,
    lastName,
    middleName,
    jobTitle: pickText(item, ['jobTitle', 'position', 'title', 'roleName', 'profession', 'vezife']) || '-',
    phone1,
    phone2: pickText(item, ['phone2', 'secondaryPhone', 'personalPhone']) || additionalInfo.phone2 || '',
    extensionNumber: pickText(item, ['extensionNumber', 'internalNumber', 'extension', 'daxiliNomre']) || additionalInfo.extensionNumber || '',
    email,
    isActive: item.isActive === undefined && item.active === undefined ? true : asBoolean(item.isActive ?? item.active, true),
    canEdit: item.canEdit === undefined && item.canEditProfile === undefined && item.canUpdate === undefined ? true : asBoolean(item.canEdit ?? item.canEditProfile ?? item.canUpdate, true),
    role: normalizeRole(findDeep(item, ['role', 'roles', 'userRole', 'roleName', 'accountRole'])),
    whatsapp: pickText(item, ['whatsapp', 'whatsappPhone', 'whatsApp', 'whatsAppPhone', 'wp', 'wpNumber']) || additionalInfo.whatsapp || '',
    linkedin: pickText(item, ['linkedin', 'linkedInUrl', 'linkedinUrl', 'linkedIn', 'linkedInProfile']) || pickSocialUrl(socialAccounts, 'linkedin') || additionalInfo.linkedin || '',
    facebook: pickText(item, ['facebook', 'facebookUrl', 'fb', 'fbUrl']) || pickSocialUrl(socialAccounts, 'facebook') || additionalInfo.facebook || '',
    instagram: pickText(item, ['instagram', 'instagramUrl', 'insta', 'instaUrl']) || pickSocialUrl(socialAccounts, 'instagram') || additionalInfo.instagram || '',
    photo: photoData || photoUrl,
    photoUrl: photoData || photoUrl,
    photoData,
    scans: asNumber(item.scans || item.scanCount, 0),
    scanCount: asNumber(item.scanCount || item.scans, 0),
    companyId,
    companyName: pickText(item, ['companyName']) || cleanText(findDeep(item, ['companyName', 'name'])),
    companyVoen: pickText(item, ['companyVoen', 'voen', 'taxId', 'taxNumber']),
    qrUid: pickQrUid(item, id, email),
    qrCode: pickText(item, ['qrCode']),
    cardUid: pickText(item, ['cardUid', 'cardUuid']),
    additionalInfo: cleanVisibleAdditionalInfo(pickText(item, ['additionalInfo', 'description', 'bio', 'about'])),
    dateOfBirth: pickText(item, ['dateOfBirth', 'birthDate', 'birthday', 'dob']),
    address: pickText(item, ['address', 'homeAddress', 'residentialAddress', 'location']),
    googleMapsUrl: pickText(item, ['googleMapsUrl', 'mapsUrl', 'mapUrl', 'addressUrl']),
    cardBackgroundUrl: normalizeAssetUrl(pickText(item, ['cardBackgroundUrl', 'cardBackground', 'backgroundUrl', 'backgroundImageUrl'])),
    socialAccounts: customSocialAccounts,
  };
};

export const normalizeUserWithLocalOverride = (
  raw: unknown,
  companyId?: string,
  companyVoen?: string
): NormalizedUser => {
  const item = (isRecord(raw) ? raw : {}) as AnyRecord;
  return normalizeUser(applyLocalEmployeeOverrideToRecord(item, companyId, companyVoen));
};
