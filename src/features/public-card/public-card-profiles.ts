import { runtimeStorage } from '../../storage/runtime.storage';
import { publicAxiosInstance } from '../../api/client';
import { asBoolean, asNumber, findDeep, findStringDeep, isRecord, normalizeArray, unwrapData, type AnyRecord } from '../../utils/api.utils';
import { findLocalEmployeeById, readLocalEmployeeAccounts, type LocalEmployeeAccount } from '../../storage/local-auth/employee-local-auth';
import { getSavedCompanySnapshot } from '../../storage/company.storage';
import { getSavedCompanyCardBackground, getSavedCompanyCardBackgroundAsync } from '../company/company-card-theme';
import { normalizeAssetUrl } from '../../utils/asset-url.utils';
import { stripSocialLinksFromAdditionalInfo } from '../profile/profile-info';
import type { NormalizedCompanyInfo, NormalizedUser } from '../../types/company.type';
import type { PublicCardProfile, PublicContactExtra, PublicContactPhone, PublicContactSocial, ScanSource } from '../../types/public-card.type';
import {PUBLIC_CARD_STORAGE_KEY,getCompanyLogoFromSources,getPublicCardUrl,getSavedCompanyLogoForProfile,normalizeEmail,normalizeText,pickPublicEmail,readStoredArray,resolveQrUid,saveStoredArray,getEmployeePhotoFromRecord,pickPublicCardPhoto,} from './public-card-shared';


const getCardBackgroundFromRecord = (record: AnyRecord) => normalizeAssetUrl(
  record.cardBackgroundUrl ||
    record.cardBackgroundURL ||
    record.cardBackground ||
    record.cardBackgroundPath ||
    record.backgroundUrl ||
    record.backgroundURL ||
    record.backgroundImageUrl ||
    record.backgroundImage ||
    record.profileBackgroundUrl ||
    record.profileCardBackgroundUrl ||
    findStringDeep(record, [
      'cardBackgroundUrl',
      'cardBackgroundURL',
      'cardBackground',
      'cardBackgroundPath',
      'backgroundUrl',
      'backgroundURL',
      'backgroundImageUrl',
      'backgroundImage',
      'profileBackgroundUrl',
      'profileCardBackgroundUrl',
    ])
);

const toPublicCardRecord = (payload: unknown, fallbackId: string): AnyRecord => {
  const root = unwrapData(payload);
  if (!isRecord(root)) return { id: fallbackId };

  const nestedCandidates = ['user', 'profile', 'employee', 'card', 'publicCard'];
  const nested = nestedCandidates
    .map((key) => root[key])
    .find((value): value is AnyRecord => isRecord(value));

  return {
    ...root,
    ...(nested || {}),
    id: (nested?.id || nested?.userId || nested?.employeeId || root.id || root.userId || root.employeeId || fallbackId) as unknown,
    company: nested?.company || root.company,
    companyName: nested?.companyName || root.companyName,
    companyLogoUrl: nested?.companyLogoUrl || root.companyLogoUrl,
    companyLogo: nested?.companyLogo || root.companyLogo,
    cardBackgroundUrl:
      nested?.cardBackgroundUrl ||
      nested?.cardBackgroundURL ||
      root.cardBackgroundUrl ||
      root.cardBackgroundURL ||
      findStringDeep(root, ['cardBackgroundUrl', 'cardBackgroundURL', 'cardBackground']),
  };
};

export const employeeToPublicProfile = (employee: LocalEmployeeAccount): PublicCardProfile => {
  const cardUrl = getPublicCardUrl(employee.id, 'QR');
  const customSocials = (employee.socialAccounts || [])
    .map((item) => ({
      platform: normalizeText(item.platformName) || 'Website',
      url: normalizeText(item.profileUrl),
      iconUrl: normalizeText(item.iconUrl),
    }))
    .filter((item) => item.url);
  const cleanAdditionalInfo = stripSocialLinksFromAdditionalInfo(
    employee.additionalInfo,
    [employee.linkedin, employee.facebook, employee.instagram],
  );

  return {
    id: employee.id,
    employeeId: employee.id,
    companyId: employee.companyId || '',
    companyVoen: employee.voen || '',
    companyName: employee.companyName || 'Şirkət',
    companyLogo: getSavedCompanyLogoForProfile(employee.companyId, employee.voen),
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    middleName: employee.middleName || '',
    jobTitle: employee.jobTitle || '',
    email: normalizeEmail(employee.email) || '',
    photo: pickPublicCardPhoto(employee.photoUrl, employee.photo),
    cardBackground: getCardBackgroundFromRecord(employee as unknown as AnyRecord) || getSavedCompanyCardBackground(employee.companyId, employee.voen),
    dateOfBirth: normalizeText(employee.dateOfBirth),
    address: normalizeText(employee.address),
    googleMapsUrl: normalizeText(employee.googleMapsUrl),
    phones: [
      employee.phone1 ? { type: 'İş', number: employee.phone1 } : null,
      employee.phone2 ? { type: 'Şəxsi', number: employee.phone2 } : null,
      employee.whatsapp ? { type: 'WhatsApp', number: employee.whatsapp } : null,
    ].filter(Boolean) as PublicContactPhone[],
    socials: [
      employee.linkedin ? { platform: 'LinkedIn', url: employee.linkedin } : null,
      employee.facebook ? { platform: 'Facebook', url: employee.facebook } : null,
      employee.instagram ? { platform: 'Instagram', url: employee.instagram } : null,
      ...customSocials,
    ].filter(Boolean) as PublicContactSocial[],
    extras: [
      employee.extensionNumber ? { label: 'Daxili nömrə', value: employee.extensionNumber } : null,
      cleanAdditionalInfo ? { label: 'Əlavə məlumat', value: cleanAdditionalInfo } : null,
    ].filter(Boolean) as PublicContactExtra[],
    nfcUrl: getPublicCardUrl(employee.id, 'NFC'),
    qrUid: resolveQrUid((employee as unknown as AnyRecord).qrUid, (employee as unknown as AnyRecord).qrCode, (employee as unknown as AnyRecord).cardUid, employee.id, employee.email),
    cardUrl,
    isActive: employee.isActive !== false,
    status: employee.isActive === false ? 'inactive' : 'active',
    scans: asNumber(employee.scans, 0),
    updatedAt: employee.updatedAt || new Date().toISOString(),
  };
};

const getRecordList = (record: AnyRecord, keys: string[]) => {
  for (const key of keys) {
    const direct = normalizeArray<AnyRecord>(record[key]);
    if (direct.length > 0) return direct;
  }

  return normalizeArray<AnyRecord>(findDeep(record, keys));
};

const getContactValue = (record: AnyRecord) => normalizeText(
  record.value || record.contactValue || record.number || record.phone || record.email || record.url
);

const getContactTypeParts = (record: AnyRecord) => [
  record.label,
  record.contactTypeName,
  record.contactName,
  record.contactType,
  record.type,
  record.category,
  record.kind,
  record.name,
].map((value) => normalizeText(value)).filter(Boolean);

const getContactType = (record: AnyRecord) => getContactTypeParts(record)[0] || '';
const getContactTypeMarker = (record: AnyRecord) => getContactTypeParts(record).join(' ');

const isPhoneContact = (type: string) => /(phone|telefon|mobile|mobil|whatsapp|iş|is|şəxsi|sexsi)/i.test(type);
const isWhatsappContact = (type: string) => /(whatsapp|whats app|wp)/i.test(type);
const isExtensionContact = (type: string) => /(extension|internal|daxili|ext\.?\b|pbx)/i.test(type);
const isEmailContact = (type: string) => /(email|e-poçt|epoct|mail)/i.test(type);
const isSocialContact = (type: string, value: string) => (
  /(linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com|telegram|sosial|social)/i.test(type) ||
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin|facebook|instagram|youtube|tiktok|twitter|x)\.com\//i.test(value)
);

const comparablePhoneValue = (value: string) => value.replace(/\D/g, '') || value.trim().toLowerCase();

const mergePublicContactExtras = (
  ...groups: Array<PublicContactExtra[] | undefined>
): PublicContactExtra[] => {
  const seen = new Set<string>();
  const result: PublicContactExtra[] = [];

  groups.flatMap((group) => group || []).forEach((extra) => {
    const label = normalizeText(extra?.label);
    const rawValue = normalizeText(extra?.value);
    const value = stripSocialLinksFromAdditionalInfo(rawValue);

    if (!value || isSocialContact(label, rawValue)) return;

    const normalizedLabel = isExtensionContact(label) ? 'Daxili nömrə' : label || 'Məlumat';
    const key = `${normalizedLabel.toLowerCase()}:${value.toLowerCase()}`;
    if (seen.has(key)) return;

    seen.add(key);
    result.push({ label: normalizedLabel, value });
  });

  return result;
};

const mergePublicContactPhones = (
  extras: PublicContactExtra[],
  ...groups: Array<PublicContactPhone[] | undefined>
): PublicContactPhone[] => {
  const extensionValues = new Set(
    extras
      .filter((extra) => isExtensionContact(extra.label))
      .map((extra) => comparablePhoneValue(extra.value))
      .filter(Boolean)
  );
  const seen = new Set<string>();
  const result: PublicContactPhone[] = [];

  const append = (phones: PublicContactPhone[] | undefined, whatsappOnly = false) => {
    (phones || []).forEach((phone) => {
      const number = normalizeText(phone?.number);
      const type = normalizeText(phone?.type) || 'Telefon';
      const comparable = comparablePhoneValue(number);
      const whatsapp = isWhatsappContact(type);
      if (whatsappOnly && !whatsapp) return;
      if (!comparable || isExtensionContact(type) || extensionValues.has(comparable)) return;
      const normalizedType = whatsapp ? 'WhatsApp' : type;
      const key = `${whatsapp ? 'whatsapp' : 'phone'}:${comparable}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ type: normalizedType, number });
    });
  };

  const [primary, ...fallbacks] = groups;
  append(primary);

  if (result.length === 0) {
    fallbacks.forEach((group) => append(group));
  } else if (!result.some((phone) => isWhatsappContact(phone.type))) {
    // Public endpoint əsas telefonları qaytarıb WhatsApp sahəsini buraxdıqda yalnız
    // çatışmayan WhatsApp nömrəsini lokal/saxlanmış profildən tamamlayırıq.
    fallbacks.forEach((group) => append(group, true));
  }

  return result;
};

export const normalizeUserToPublicProfile = (
  user: NormalizedUser | AnyRecord,
  company?: Partial<NormalizedCompanyInfo>,
): PublicCardProfile => {
  const record = user as AnyRecord;
  const companyRecord = isRecord(record.company) ? record.company : {};
  const contactInfos = getRecordList(record, ['contactInfos', 'contacts', 'userContactInfos']);
  const socialAccounts = getRecordList(record, ['socialAccounts', 'socials', 'socialLinks']);
  const id = normalizeText(record.id || record.employeeId || record.userId || record.email) || crypto.randomUUID();
  const companyId = normalizeText(record.companyId || companyRecord.id || company?.id);
  const companyName = normalizeText(record.companyName || companyRecord.name || companyRecord.companyName || company?.name) || 'Şirkət';
  const companyVoen = normalizeText(record.companyVoen || record.voen || companyRecord.voen || company?.voen);
  const logo = getCompanyLogoFromSources(
    {
      logoUrl: record.companyLogoUrl || companyRecord.logoUrl || record.logoUrl,
      logo: record.companyLogo || companyRecord.logo || record.logo,
      logoPath: record.companyLogoPath || companyRecord.logoPath || record.logoPath,
    },
    company,
    getSavedCompanySnapshot(companyId, companyVoen),
  );
  const isActive = record.isActive === undefined ? true : asBoolean(record.isActive, true);
  const directPhone1 = normalizeText(
    record.phone1 || record.phone || record.phoneNumber || record.mobile || findStringDeep(record, ['phone1', 'phoneNumber', 'mobile'])
  );
  const directPhone2 = normalizeText(
    record.phone2 || record.secondaryPhone || record.personalPhone || findStringDeep(record, ['phone2', 'secondaryPhone', 'personalPhone'])
  );
  const directWhatsapp = normalizeText(
    record.whatsapp ||
      record.whatsappPhone ||
      record.whatsApp ||
      record.whatsAppPhone ||
      record.wp ||
      record.wpNumber ||
      findStringDeep(record, ['whatsapp', 'whatsappPhone', 'whatsApp', 'whatsAppPhone', 'wp', 'wpNumber'])
  );
  const directExtension = normalizeText(
    record.extensionNumber ||
      record.internalNumber ||
      record.extension ||
      record.daxiliNomre ||
      findStringDeep(record, ['extensionNumber', 'internalNumber', 'extension', 'daxiliNomre'])
  );
  const extensionContacts = contactInfos
    .filter((item) => isExtensionContact(getContactTypeMarker(item)) && getContactValue(item))
    .map((item) => getContactValue(item));
  const extensionValues = new Set(
    [directExtension, ...extensionContacts]
      .map((value) => value.replace(/\D/g, '') || value.toLowerCase())
      .filter(Boolean)
  );
  const phoneCandidates: PublicContactPhone[] = [
    ...contactInfos
      .filter((item) => {
        const typeMarker = getContactTypeMarker(item);
        const value = getContactValue(item);
        if (!value || !isPhoneContact(typeMarker) || isExtensionContact(typeMarker)) return false;
        const comparable = value.replace(/\D/g, '') || value.toLowerCase();
        return !extensionValues.has(comparable);
      })
      .map((item) => {
        const type = getContactType(item);
        const typeMarker = getContactTypeMarker(item);
        return {
          type: isWhatsappContact(typeMarker) ? 'WhatsApp' : type || 'Telefon',
          number: getContactValue(item),
        };
      }),
    ...(directPhone1 ? [{ type: 'İş', number: directPhone1 }] : []),
    ...(directPhone2 ? [{ type: 'Şəxsi', number: directPhone2 }] : []),
    ...(directWhatsapp ? [{ type: 'WhatsApp', number: directWhatsapp }] : []),
  ];
  const seenPhones = new Set<string>();
  const contactPhones = phoneCandidates.filter((phone) => {
    const normalizedNumber = phone.number.replace(/\D/g, '') || phone.number.trim().toLowerCase();
    if (!normalizedNumber) return false;
    const group = isWhatsappContact(phone.type) ? 'whatsapp' : 'phone';
    const key = `${group}:${normalizedNumber}`;
    if (seenPhones.has(key)) return false;
    seenPhones.add(key);
    return true;
  });
  const contactEmail = contactInfos.find((item) => isEmailContact(getContactTypeMarker(item)) && getContactValue(item));
  const mappedSocials = socialAccounts
    .map((item) => ({
      platform: normalizeText(item.platformName || item.platform || item.type || item.name) || 'Website',
      url: normalizeText(item.profileUrl || item.url || item.link || item.value || item.href),
      iconUrl: normalizeText(item.iconUrl || item.icon || item.imageUrl || item.image),
    }))
    .filter((item) => item.url);
  const fallbackSocials = [
    (record.linkedin || record.linkedinUrl)
      ? { platform: 'LinkedIn', url: normalizeText(record.linkedin || record.linkedinUrl) }
      : null,
    (record.facebook || record.facebookUrl)
      ? { platform: 'Facebook', url: normalizeText(record.facebook || record.facebookUrl) }
      : null,
    (record.instagram || record.instagramUrl)
      ? { platform: 'Instagram', url: normalizeText(record.instagram || record.instagramUrl) }
      : null,
  ].filter(Boolean) as PublicContactSocial[];
  const publicSocials = mappedSocials.length > 0 ? mappedSocials : fallbackSocials;
  const cleanAdditionalInfo = stripSocialLinksFromAdditionalInfo(
    record.additionalInfo || record.extraInfo || record.description || record.details,
    publicSocials.map((social) => social.url),
  );
  const extraCandidates: PublicContactExtra[] = [
    ...contactInfos
      .filter((item) => {
        const typeMarker = getContactTypeMarker(item);
        const value = getContactValue(item);
        return value && (isExtensionContact(typeMarker) || (!isPhoneContact(typeMarker) && !isEmailContact(typeMarker) && !isSocialContact(typeMarker, value)));
      })
      .map((item) => ({
        label: isExtensionContact(getContactTypeMarker(item)) ? 'Daxili nömrə' : getContactType(item) || 'Məlumat',
        value: getContactValue(item),
      })),
    ...(directExtension ? [{ label: 'Daxili nömrə', value: directExtension }] : []),
    ...(record.department ? [{ label: 'Departament', value: normalizeText(record.department) }] : []),
    ...(cleanAdditionalInfo ? [{ label: 'Əlavə məlumat', value: cleanAdditionalInfo }] : []),
  ];
  const contactExtras = mergePublicContactExtras(extraCandidates);

  return {
    id,
    employeeId: id,
    companyId,
    companyVoen,
    companyName,
    companyLogo: logo,
    firstName: normalizeText(record.firstName),
    lastName: normalizeText(record.lastName),
    middleName: normalizeText(record.middleName),
    jobTitle: normalizeText(record.jobTitle || record.position || record.title),
    email: pickPublicEmail(record) || normalizeEmail(getContactValue(contactEmail || {})),
    photo: getEmployeePhotoFromRecord(record),
    cardBackground: getCardBackgroundFromRecord(record) || getSavedCompanyCardBackground(companyId, companyVoen),
    dateOfBirth: normalizeText(record.dateOfBirth || record.birthDate || record.birthday || record.dob),
    address: normalizeText(record.address || record.homeAddress || record.residentialAddress || record.location),
    googleMapsUrl: normalizeText(record.googleMapsUrl || record.mapsUrl || record.mapUrl || record.addressUrl),
    phones: contactPhones,
    socials: publicSocials,
    extras: contactExtras,
    nfcUrl: getPublicCardUrl(id, 'NFC'),
    qrUid: resolveQrUid(record.qrUid, record.qrCode, record.cardUid, record.qrUUID, record.qrUuid, id, record.email),
    cardUrl: getPublicCardUrl(id, 'QR'),
    isActive,
    status: isActive ? 'active' : 'inactive',
    scans: asNumber(record.scans || record.scanCount, 0),
    updatedAt: new Date().toISOString(),
  };
};

export const readPublicCardProfiles = () => readStoredArray<PublicCardProfile>(PUBLIC_CARD_STORAGE_KEY);

const publicProfileMatches = (row: PublicCardProfile, profile: PublicCardProfile) => {
  const cleanId = normalizeText(profile.id);
  const cleanEmail = normalizeEmail(profile.email);
  const cleanQrUid = normalizeText(profile.qrUid);
  const cleanCardUrl = normalizeText(profile.cardUrl);

  return (
    row.id === cleanId ||
    row.employeeId === cleanId ||
    (cleanQrUid && row.qrUid === cleanQrUid) ||
    (cleanCardUrl && row.cardUrl === cleanCardUrl) ||
    (cleanEmail && normalizeEmail(row.email) === cleanEmail)
  );
};

const mergePublicProfileForStorage = (
  profile: PublicCardProfile,
  rows: PublicCardProfile[],
  preserveExistingPhoto = true,
) => {
  const existing = rows.find((row) => publicProfileMatches(row, profile));
  const companyLogo =
    profile.companyLogo ||
    existing?.companyLogo ||
    getSavedCompanyLogoForProfile(profile.companyId, profile.companyVoen);
  const canonicalCompanyBackground = getSavedCompanyCardBackground(
    profile.companyId || existing?.companyId,
    profile.companyVoen || existing?.companyVoen,
  );
  const mergedExtras = profile.extras?.length
    ? mergePublicContactExtras(profile.extras)
    : mergePublicContactExtras(existing?.extras);

  return {
    ...profile,
    email: normalizeEmail(profile.email) || existing?.email || '',
    phones: profile.phones?.length
      ? mergePublicContactPhones(mergedExtras, profile.phones)
      : mergePublicContactPhones(mergedExtras, existing?.phones),
    socials: profile.socials?.length ? profile.socials : existing?.socials || [],
    extras: mergedExtras,
    dateOfBirth: profile.dateOfBirth || existing?.dateOfBirth || '',
    address: profile.address || existing?.address || '',
    googleMapsUrl: profile.googleMapsUrl || existing?.googleMapsUrl || '',
    photo: pickPublicCardPhoto(profile.photo, preserveExistingPhoto ? existing?.photo : ''),
    cardBackground:
      canonicalCompanyBackground ||
      normalizeAssetUrl(profile.cardBackground) ||
      normalizeAssetUrl(existing?.cardBackground),
    companyLogo,
    updatedAt: new Date().toISOString(),
  } satisfies PublicCardProfile;
};

const upsertPublicProfile = (
  rows: PublicCardProfile[],
  profile: PublicCardProfile,
  preserveExistingPhoto = true,
) => {
  const nextProfile = mergePublicProfileForStorage(profile, rows, preserveExistingPhoto);
  const withoutCurrent = rows.filter((row) => !publicProfileMatches(row, nextProfile));
  return [nextProfile, ...withoutCurrent].slice(0, 500);
};

export const savePublicCardProfile = (profile: PublicCardProfile, options: { preserveExistingPhoto?: boolean } = {}) => {
  const rows = readPublicCardProfiles();
  const nextRows = upsertPublicProfile(rows, profile, options.preserveExistingPhoto !== false);
  saveStoredArray(PUBLIC_CARD_STORAGE_KEY, nextRows);
  return nextRows[0];
};

export const savePublicCardProfilesFromUsers = (
  users: NormalizedUser[],
  company?: Partial<NormalizedCompanyInfo>,
) => {
  if (users.length === 0) return;

  let rows = readPublicCardProfiles();
  users.forEach((user) => {
    rows = upsertPublicProfile(rows, normalizeUserToPublicProfile(user, company));
  });

  saveStoredArray(PUBLIC_CARD_STORAGE_KEY, rows);
};


export const readStoredArrayFrom = <T,>(storage: Storage, key: string): T[] => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    return normalizeArray<T>(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const readStoredArrayByPrefix = <T,>(prefix: string): T[] => {
  const rows: T[] = [];
  const read = (storage: Storage) => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      rows.push(...readStoredArrayFrom<T>(storage, key));
    }
  };

  try {
    read(runtimeStorage);
    read(localStorage);
  } catch {
    return rows;
  }

  return rows;
};

export const profileIdentityValues = (record: AnyRecord) => [
  record.id,
  record.userId,
  record.employeeId,
  record.cardId,
  record.businessCardId,
  record.profileId,
  record.qrUid,
  record.qrUUID,
  record.qrUuid,
  record.qrCode,
  record.cardUid,
  record.cardUuid,
  record.uuid,
  record.publicId,
  record.publicCardId,
  record.email,
  record.email1,
  record.gmail,
  record.mail,
  record.userEmail,
  record.emailAddress,
].map((value) => normalizeText(value)).filter(Boolean);

export const isSamePublicIdentity = (record: AnyRecord, lookupId: string) => {
  const cleanLookup = normalizeText(lookupId);
  const lookupEmail = normalizeEmail(cleanLookup);
  if (!cleanLookup) return false;

  return profileIdentityValues(record).some((value) => {
    return value === cleanLookup || (lookupEmail && normalizeEmail(value) === lookupEmail);
  });
};

export const readKnownPublicUserRecords = (lookupId: string): AnyRecord[] => {
  const cleanLookup = normalizeText(lookupId);
  const records: AnyRecord[] = [];

  const pushRecords = (rows: unknown[]) => {
    normalizeArray<AnyRecord>(rows).forEach((row) => {
      if (row && typeof row === 'object' && isSamePublicIdentity(row, cleanLookup)) records.push(row);
    });
  };

  pushRecords(readStoredArrayFrom<AnyRecord>(runtimeStorage, PUBLIC_CARD_STORAGE_KEY));
  pushRecords(readStoredArrayFrom<AnyRecord>(localStorage, PUBLIC_CARD_STORAGE_KEY));
  pushRecords(readStoredArrayFrom<AnyRecord>(runtimeStorage, 'employeeAccounts'));
  pushRecords(readStoredArrayFrom<AnyRecord>(localStorage, 'employeeAccounts'));
  pushRecords(readStoredArrayFrom<AnyRecord>(runtimeStorage, 'employeeAccountOverrides'));
  pushRecords(readStoredArrayFrom<AnyRecord>(localStorage, 'employeeAccountOverrides'));
  pushRecords(readStoredArrayByPrefix<AnyRecord>('companyUsersCache:'));

  return records;
};

export const mergePublicProfileData = (profile: PublicCardProfile, fallback: PublicCardProfile): PublicCardProfile => {
  const companyId = profile.companyId || fallback.companyId || '';
  const companyVoen = profile.companyVoen || fallback.companyVoen || '';
  const canonicalCompanyBackground = getSavedCompanyCardBackground(companyId, companyVoen);
  const mergedExtras = mergePublicContactExtras(profile.extras, fallback.extras);

  return {
    ...fallback,
    ...profile,
    email: normalizeEmail(profile.email) || fallback.email || '',
    phones: mergePublicContactPhones(mergedExtras, profile.phones, fallback.phones),
    socials: profile.socials?.length ? profile.socials : fallback.socials || [],
    extras: mergedExtras,
    dateOfBirth: profile.dateOfBirth || fallback.dateOfBirth || '',
    address: profile.address || fallback.address || '',
    googleMapsUrl: profile.googleMapsUrl || fallback.googleMapsUrl || '',
    companyLogo: profile.companyLogo || fallback.companyLogo || '',
    photo: pickPublicCardPhoto(profile.photo, fallback.photo),
    cardBackground: canonicalCompanyBackground || profile.cardBackground || fallback.cardBackground || '',
    companyId,
    companyVoen,
    companyName: profile.companyName || fallback.companyName || 'Şirkət',
  };
};

export const hydratePublicProfileFromKnownSources = (profile: PublicCardProfile, ...lookupIds: string[]) => {
  const seen = new Set<string>();
  let hydrated = profile;

  lookupIds
    .map((lookupId) => normalizeText(lookupId))
    .filter(Boolean)
    .forEach((lookupId) => {
      readKnownPublicUserRecords(lookupId).forEach((record) => {
        const key = JSON.stringify(profileIdentityValues(record));
        if (seen.has(key)) return;
        seen.add(key);
        hydrated = mergePublicProfileData(hydrated, normalizeUserToPublicProfile(record));
      });
    });

  return hydrated;
};

export const findStoredPublicCardProfile = (id: string): PublicCardProfile | null => {
  const cleanId = decodeURIComponent(id || '').trim();
  const cleanEmail = normalizeEmail(cleanId);
  if (!cleanId) return null;

  const stored = readPublicCardProfiles().find((profile) => {
    return (
      profile.id === cleanId ||
      profile.employeeId === cleanId ||
      profile.qrUid === cleanId ||
      normalizeEmail(profile.email) === cleanEmail
    );
  });

  const localEmployee =
    findLocalEmployeeById(cleanId) ||
    readLocalEmployeeAccounts().find((employee) => cleanEmail && normalizeEmail(employee.email) === cleanEmail) ||
    null;

  if (stored) {
    const localProfile = localEmployee ? employeeToPublicProfile(localEmployee) : null;
    const hydratedLogo = stored.companyLogo || getSavedCompanyLogoForProfile(stored.companyId, stored.companyVoen) || localProfile?.companyLogo || '';
    const hydratedEmail = normalizeEmail(stored.email) || localProfile?.email || '';
    const hydratedExtras = mergePublicContactExtras(stored.extras, localProfile?.extras);
    const hydratedPhones = mergePublicContactPhones(hydratedExtras, stored.phones, localProfile?.phones);
    const hydratedSocials = stored.socials?.length ? stored.socials : localProfile?.socials || [];
    const hydratedPhoto = pickPublicCardPhoto(stored.photo, localProfile?.photo);
    const canonicalCompanyBackground = getSavedCompanyCardBackground(
      stored.companyId || localProfile?.companyId,
      stored.companyVoen || localProfile?.companyVoen,
    );
    const knownHydrated = hydratePublicProfileFromKnownSources({
      ...stored,
      email: hydratedEmail,
      phones: hydratedPhones,
      socials: hydratedSocials,
      extras: hydratedExtras,
      dateOfBirth: stored.dateOfBirth || localProfile?.dateOfBirth || '',
      address: stored.address || localProfile?.address || '',
      googleMapsUrl: stored.googleMapsUrl || localProfile?.googleMapsUrl || '',
      photo: hydratedPhoto,
      cardBackground: canonicalCompanyBackground || stored.cardBackground || localProfile?.cardBackground || '',
      companyLogo: hydratedLogo,
    }, cleanId, stored.id, stored.employeeId, stored.qrUid, hydratedEmail);

    if (
      knownHydrated.companyLogo !== stored.companyLogo ||
      knownHydrated.email !== stored.email ||
      knownHydrated.phones !== stored.phones ||
      knownHydrated.socials !== stored.socials ||
      knownHydrated.extras !== stored.extras ||
      knownHydrated.photo !== stored.photo ||
      knownHydrated.cardBackground !== stored.cardBackground
    ) {
      return savePublicCardProfile(knownHydrated);
    }

    return stored;
  }

  if (!localEmployee) return null;

  return savePublicCardProfile(employeeToPublicProfile(localEmployee));
};

export const findPublicCardProfile = (id: string): PublicCardProfile | null => {
  return findStoredPublicCardProfile(id);
};

export const fetchPublicCardProfile = async (
  id: string,
  source: ScanSource = 'Direct',
): Promise<PublicCardProfile | null> => {
  const cleanId = decodeURIComponent(id || '').trim();
  if (!cleanId) return null;

  // Public card həmişə backend public endpoint-dən yüklənir. Bu sorğu Network-də
  // görünür və giriş tokenindən asılı deyil. Session məlumatı yalnız fallback-dir.
  const storedProfile = findStoredPublicCardProfile(cleanId);

  try {
    const response = await publicAxiosInstance.get(`/api/cards/${encodeURIComponent(cleanId)}`, {
      params: { source },
      headers: { 'Cache-Control': 'no-cache' },
    });

    const rawRecord = toPublicCardRecord(response.data, cleanId);
    const profile = normalizeUserToPublicProfile(rawRecord);
    const profileId = normalizeText(profile.id) || cleanId;

    const fallback =
      storedProfile ||
      findStoredPublicCardProfile(profileId) ||
      findStoredPublicCardProfile(profile.email) ||
      findStoredPublicCardProfile(profile.employeeId) ||
      null;

    const persistedCompanyBackground = await getSavedCompanyCardBackgroundAsync(
      profile.companyId || fallback?.companyId,
      profile.companyVoen || fallback?.companyVoen,
    );

    const mergedExtras = mergePublicContactExtras(profile.extras, fallback?.extras);
    const finalProfile: PublicCardProfile = {
      ...(fallback || profile),
      ...profile,
      id: profileId,
      employeeId: profile.employeeId || fallback?.employeeId || profileId,
      email: normalizeEmail(profile.email) || fallback?.email || '',
      phones: mergePublicContactPhones(mergedExtras, profile.phones, fallback?.phones),
      socials: profile.socials?.length ? profile.socials : fallback?.socials || [],
      extras: mergedExtras,
      dateOfBirth: profile.dateOfBirth || fallback?.dateOfBirth || '',
      address: profile.address || fallback?.address || '',
      googleMapsUrl: profile.googleMapsUrl || fallback?.googleMapsUrl || '',
      qrUid: profile.qrUid || fallback?.qrUid || cleanId,
      cardUrl: getPublicCardUrl(profileId, source),
      nfcUrl: getPublicCardUrl(profileId, 'NFC'),
      companyLogo: profile.companyLogo || fallback?.companyLogo || '',
      photo: pickPublicCardPhoto(fallback?.photo, profile.photo),
      cardBackground: persistedCompanyBackground || profile.cardBackground || fallback?.cardBackground || '',
    };

    return savePublicCardProfile(
      hydratePublicProfileFromKnownSources(finalProfile, cleanId, profileId, profile.employeeId, profile.email, fallback?.email || ''),
      { preserveExistingPhoto: true }
    );
  } catch (error) {
    console.warn('Public card backend sorğusu uğursuz oldu, session fallback istifadə edilir:', error);
    return storedProfile || findStoredPublicCardProfile(cleanId);
  }
};
