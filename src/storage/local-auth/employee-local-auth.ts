import { runtimeStorage } from '../runtime.storage';
import { asBoolean, asNumber, asString, findDeep, findStringDeep, normalizeArray, type AnyRecord } from '../../utils/api.utils';
import { getStoredUser } from '../auth.storage';
import type { LocalAuditLog, LocalEmployeeAccount, LocalEmployeeOverride } from '../../types/local-auth.type';

export type { LocalAuditLog, LocalEmployeeAccount, LocalEmployeeOverride } from '../../types/local-auth.type';

const EMPLOYEE_STORAGE_KEY = 'employeeAccounts';
const EMPLOYEE_OVERRIDE_STORAGE_KEY = 'employeeAccountOverrides';
const AUDIT_STORAGE_KEY = 'localAuditLogs';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeVoen = (value: string) => value.trim();

const pickSocialUrlFromRecord = (record: AnyRecord, wanted: string) => {
  const key = wanted.toLowerCase();
  const source = record.socialAccounts || record.socials || record.socialLinks || findDeep(record, ['socialAccounts', 'socials', 'socialLinks']);

  return normalizeArray<AnyRecord>(source).find((account) => {
    const platform = findStringDeep(account, ['platform', 'platformName', 'socialPlatform', 'socialMedia', 'socialMediaName', 'type', 'name', 'label']).toLowerCase();
    const url = findStringDeep(account, ['url', 'link', 'value', 'href', 'profileUrl', 'accountUrl', 'socialUrl']).toLowerCase();
    return platform.includes(key) || url.includes(key);
  }) ? findStringDeep(
    normalizeArray<AnyRecord>(source).find((account) => {
      const platform = findStringDeep(account, ['platform', 'platformName', 'socialPlatform', 'socialMedia', 'socialMediaName', 'type', 'name', 'label']).toLowerCase();
      const url = findStringDeep(account, ['url', 'link', 'value', 'href', 'profileUrl', 'accountUrl', 'socialUrl']).toLowerCase();
      return platform.includes(key) || url.includes(key);
    }),
    ['url', 'link', 'value', 'href', 'profileUrl', 'accountUrl', 'socialUrl']
  ) : '';
};

const buildSocialAccountsRecord = (source: { linkedin?: string; facebook?: string; instagram?: string }) => {
  return [
    { platform: 'LinkedIn', platformName: 'LinkedIn', url: asString(source.linkedin) },
    { platform: 'Facebook', platformName: 'Facebook', url: asString(source.facebook) },
    { platform: 'Instagram', platformName: 'Instagram', url: asString(source.instagram) },
  ].filter((item) => item.url);
};

const parseStoredArray = <T>(raw: string | null): T[] => {
  if (!raw) return [];

  try {
    return normalizeArray<T>(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
};

const readArray = <T>(key: string): T[] => {
  const sessionRows = parseStoredArray<T>(runtimeStorage.getItem(key));
  const localRows = parseStoredArray<T>(localStorage.getItem(key));

  return [...sessionRows, ...localRows];
};

const LOCAL_EMPLOYEE_BACKUP_KEYS = new Set([
  EMPLOYEE_STORAGE_KEY,
  EMPLOYEE_OVERRIDE_STORAGE_KEY,
]);

const saveArray = <T>(key: string, rows: T[]) => {
  const serialized = JSON.stringify(rows);
  runtimeStorage.setItem(key, serialized);

  // İşçi şəkli və redaktə icazəsi logout/login və brauzer yenilənməsindən sonra
  // itirilməsin deyə employee məlumatları üçün sinxron localStorage ehtiyatı saxlayırıq.
  // Digər runtime məlumatları əvvəlki kimi yalnız runtime/IndexedDB axınında qalır.
  if (LOCAL_EMPLOYEE_BACKUP_KEYS.has(key)) {
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // localStorage limiti dolarsa runtimeStorage/IndexedDB əsas mənbə olaraq qalır.
    }
  } else {
    localStorage.removeItem(key);
  }
};

const employeeKeyFromRecord = (record: AnyRecord) => {
  return asString(record.id || record.userId || record.employeeId || record.cardId || record.email || record.gmail || record.mail);
};

export const readLocalEmployeeOverrides = (): LocalEmployeeOverride[] => {
  return readArray<LocalEmployeeOverride>(EMPLOYEE_OVERRIDE_STORAGE_KEY).filter((item) => Boolean(item.id || item.email));
};

const normalizeProfileText = (value?: string) => asString(value).trim().toLowerCase();

const sameOverrideTarget = (override: LocalEmployeeOverride, target: Partial<LocalEmployeeOverride>) => {
  const overrideId = (override.id || '').trim();
  const targetId = (target.id || '').trim();
  const overrideEmail = normalizeEmail(override.email || '');
  const targetEmail = normalizeEmail(target.email || '');
  const overrideVoen = normalizeVoen(override.companyVoen || '');
  const targetVoen = normalizeVoen(target.companyVoen || '');
  const overrideCompanyId = (override.companyId || '').trim();
  const targetCompanyId = (target.companyId || '').trim();

  const sameId = overrideId && targetId && overrideId === targetId;
  const sameEmail = overrideEmail && targetEmail && overrideEmail === targetEmail;
  const sameCompany = !targetVoen && !targetCompanyId
    ? true
    : (overrideVoen && targetVoen && overrideVoen === targetVoen) || (overrideCompanyId && targetCompanyId && overrideCompanyId === targetCompanyId);

  const overrideName = [override.firstName, override.lastName, override.middleName]
    .map(normalizeProfileText)
    .filter(Boolean)
    .join('|');
  const targetName = [target.firstName, target.lastName, target.middleName]
    .map(normalizeProfileText)
    .filter(Boolean)
    .join('|');
  const sameName = Boolean(overrideName && targetName && overrideName === targetName);
  const sameJob = Boolean(
    normalizeProfileText(override.jobTitle) &&
      normalizeProfileText(target.jobTitle) &&
      normalizeProfileText(override.jobTitle) === normalizeProfileText(target.jobTitle)
  );
  const samePhone = Boolean(
    normalizeProfileText(override.phone1).replace(/\D/g, '') &&
      normalizeProfileText(target.phone1).replace(/\D/g, '') &&
      normalizeProfileText(override.phone1).replace(/\D/g, '') === normalizeProfileText(target.phone1).replace(/\D/g, '')
  );
  const sameProfile = sameName && (sameJob || samePhone);

  // Backend bəzən companyId/VOEN-i fərqli formatda və ya boş qaytarır.
  // Stabil employee ID tam uyğun gəlirsə override həmin işçiyə məxsusdur və
  // şirkət metadatasındakı fərq foto/redaktə icazəsini bloklamamalıdır.
  const stableIdMatch = Boolean(
    sameId &&
    !overrideId.includes('@') &&
    !targetId.includes('@')
  );

  if (stableIdMatch) return true;

  return (sameId || sameEmail || sameProfile) && sameCompany;
};

export const saveLocalEmployeeOverride = (input: Partial<LocalEmployeeOverride>) => {
  const id = (input.id || input.email || '').trim();
  const email = normalizeEmail(input.email || '');

  if (!id && !email) return null;

  const overrides = readLocalEmployeeOverrides();
  const existing = overrides.find((item) => sameOverrideTarget(item, input));
  const next: LocalEmployeeOverride = {
    ...(existing || {}),
    ...input,
    id: existing?.id || id || email,
    email: email || existing?.email,
    companyId: input.companyId || existing?.companyId,
    companyVoen: normalizeVoen(input.companyVoen || existing?.companyVoen || ''),
    updatedAt: new Date().toISOString(),
  };

  const filtered = overrides.filter((item) => !sameOverrideTarget(item, next));
  saveArray(EMPLOYEE_OVERRIDE_STORAGE_KEY, [next, ...filtered]);
  return next;
};

export const findLocalEmployeeOverride = (input: Partial<LocalEmployeeOverride>): LocalEmployeeOverride | null => {
  return readLocalEmployeeOverrides().find((item) => sameOverrideTarget(item, input)) || null;
};

export const applyLocalEmployeeOverrideToRecord = <T extends AnyRecord>(record: T, companyId?: string, companyVoen?: string): T => {
  const target: Partial<LocalEmployeeOverride> = {
    id: employeeKeyFromRecord(record),
    email: asString(record.email || record.gmail || record.mail || record.emailAddress),
    companyId: asString(record.companyId || findDeep(record, ['companyId'])) || companyId,
    companyVoen: asString(record.companyVoen || record.voen || findDeep(record, ['companyVoen', 'voen'])) || companyVoen,
    firstName: asString(record.firstName || record.first_name || record.name),
    lastName: asString(record.lastName || record.last_name || record.surname),
    middleName: asString(record.middleName || record.fatherName || record.middle_name),
    jobTitle: asString(record.jobTitle || record.position || record.title || record.roleName),
    phone1: asString(record.phone1 || record.phone || record.phoneNumber || record.mobile),
  };
  const override = findLocalEmployeeOverride(target);

  if (!override) return record;

  const overriddenSocialAccounts = override.socialAccounts !== undefined
    ? override.socialAccounts
    : (record.socialAccounts ?? record.socials ?? record.socialLinks);

  return {
    ...record,
    firstName: override.firstName ?? record.firstName,
    lastName: override.lastName ?? record.lastName,
    middleName: override.middleName ?? record.middleName,
    jobTitle: override.jobTitle ?? record.jobTitle,
    position: override.jobTitle ?? record.position,
    phone1: override.phone1 ?? record.phone1,
    phone2: override.phone2 ?? record.phone2,
    whatsapp: override.whatsapp ?? record.whatsapp,
    whatsappPhone: override.whatsapp ?? record.whatsappPhone,
    extensionNumber: override.extensionNumber ?? record.extensionNumber,
    internalNumber: override.extensionNumber ?? record.internalNumber,
    linkedin: override.linkedin ?? record.linkedin,
    linkedInUrl: override.linkedin ?? record.linkedInUrl,
    linkedinUrl: override.linkedin ?? record.linkedinUrl,
    facebook: override.facebook ?? record.facebook,
    facebookUrl: override.facebook ?? record.facebookUrl,
    instagram: override.instagram ?? record.instagram,
    instagramUrl: override.instagram ?? record.instagramUrl,
    socialAccounts: overriddenSocialAccounts,
    socials: overriddenSocialAccounts,
    socialLinks: overriddenSocialAccounts,
    photo: override.photoData ?? override.photo ?? record.photoData ?? record.photo,
    photoUrl: override.photoUrl ?? override.photoData ?? override.photo ?? record.photoUrl,
    photoData: override.photoData ?? record.photoData ?? (/^data:image\//i.test(String(override.photo || record.photo || '')) ? String(override.photo || record.photo || '') : ''),
    avatar: override.photoData ?? override.photoUrl ?? override.photo ?? record.avatar,
    cardBackground: override.cardBackground ?? override.cardBackgroundUrl ?? record.cardBackground,
    cardBackgroundUrl: override.cardBackgroundUrl ?? override.cardBackground ?? record.cardBackgroundUrl,
    additionalInfo: override.additionalInfo ?? record.additionalInfo,
    dateOfBirth: override.dateOfBirth ?? record.dateOfBirth ?? record.birthDate,
    birthDate: override.dateOfBirth ?? record.birthDate ?? record.dateOfBirth,
    address: override.address ?? record.address ?? record.homeAddress,
    homeAddress: override.address ?? record.homeAddress ?? record.address,
    googleMapsUrl: override.googleMapsUrl ?? record.googleMapsUrl ?? record.mapsUrl,
    mapsUrl: override.googleMapsUrl ?? record.mapsUrl ?? record.googleMapsUrl,
    isActive: override.isActive ?? record.isActive,
    active: override.isActive ?? record.active,
    canEdit: override.canEdit ?? record.canEdit ?? record.canEditProfile,
    canEditProfile: override.canEdit ?? record.canEditProfile ?? record.canEdit,
    canUpdate: override.canEdit ?? record.canUpdate ?? record.canEdit,
    editPermission: override.canEdit ?? record.editPermission ?? record.canEdit,
    editable: override.canEdit ?? record.editable ?? record.canEdit,
  };
};

export const applyLocalEmployeeOverrideToAccount = (employee: LocalEmployeeAccount): LocalEmployeeAccount => {
  const override = findLocalEmployeeOverride({
    id: employee.id,
    email: employee.email,
    companyId: employee.companyId,
    companyVoen: employee.voen,
  });

  if (!override) return employee;

  return {
    ...employee,
    firstName: override.firstName ?? employee.firstName,
    lastName: override.lastName ?? employee.lastName,
    middleName: override.middleName ?? employee.middleName,
    jobTitle: override.jobTitle ?? employee.jobTitle,
    phone1: override.phone1 ?? employee.phone1,
    phone2: override.phone2 ?? employee.phone2,
    whatsapp: override.whatsapp ?? employee.whatsapp,
    extensionNumber: override.extensionNumber ?? employee.extensionNumber,
    linkedin: override.linkedin ?? employee.linkedin,
    facebook: override.facebook ?? employee.facebook,
    instagram: override.instagram ?? employee.instagram,
    photo: override.photoData ?? override.photo ?? employee.photo,
    photoUrl: override.photoUrl ?? override.photoData ?? override.photo ?? employee.photoUrl,
    photoData: override.photoData ?? employee.photoData,
    cardBackground: override.cardBackground ?? override.cardBackgroundUrl ?? employee.cardBackground,
    cardBackgroundUrl: override.cardBackgroundUrl ?? override.cardBackground ?? employee.cardBackgroundUrl,
    additionalInfo: override.additionalInfo ?? employee.additionalInfo,
    dateOfBirth: override.dateOfBirth ?? employee.dateOfBirth,
    address: override.address ?? employee.address,
    googleMapsUrl: override.googleMapsUrl ?? employee.googleMapsUrl,
    isActive: override.isActive ?? employee.isActive,
    canEdit: override.canEdit ?? employee.canEdit,
    updatedAt: override.updatedAt || employee.updatedAt,
  };
};


const readEmployeeFirstLoginFlag = (record: AnyRecord, fallback = true) => {
  const value = findDeep(record, ['mustChangePassword', 'isFirstLogin', 'firstLogin', 'forcePasswordChange', 'mustChangeCode']);
  if (value === undefined || value === null || value === '') return fallback;
  return asBoolean(value, fallback);
};

const normalizeLocalEmployeeAccount = (item: LocalEmployeeAccount | AnyRecord): LocalEmployeeAccount | null => {
  const record = item as AnyRecord;
  const fullName = findStringDeep(record, ['fullName', 'name', 'userName', 'employeeName']);
  const parts = fullName.split(' ').filter(Boolean);
  const email = normalizeEmail(findStringDeep(record, ['email', 'Email', 'gmail', 'Gmail', 'mail', 'Mail', 'emailAddress', 'EmailAddress', 'userEmail', 'UserEmail', 'workEmail', 'WorkEmail']));
  const password = asString(record.password || record.code || record.kod || record.loginCode).trim();
  const voen = normalizeVoen(findStringDeep(record, ['voen', 'companyVoen', 'companyVOEN', 'taxId', 'taxNumber']));

  if (!email || !password) return null;

  const rawIsActive = findDeep(record, ['isActive', 'active', 'enabled', 'status']);
  const rawCanEdit = findDeep(record, ['canEdit', 'canEditProfile', 'canedit', 'editPermission', 'editable']);

  const mustChangePassword = readEmployeeFirstLoginFlag(record, true);

  return {
    id: asString(record.id || record.userId || record.employeeId || record.cardId) || email,
    companyId: findStringDeep(record, ['companyId', 'companyID', 'company_id']),
    companyName: findStringDeep(record, ['companyName', 'company', 'name']) || 'Şirkət',
    voen,
    firstName: findStringDeep(record, ['firstName', 'first_name', 'givenName']) || parts[0] || '',
    lastName: findStringDeep(record, ['lastName', 'last_name', 'surname']) || parts.slice(1).join(' ') || '',
    middleName: findStringDeep(record, ['middleName', 'fatherName']),
    jobTitle: findStringDeep(record, ['jobTitle', 'position', 'title', 'roleName']) || 'Əməkdaş',
    email,
    password,
    phone1: findStringDeep(record, ['phone1', 'phone', 'phoneNumber', 'mobile']) || '-',
    phone2: findStringDeep(record, ['phone2', 'secondaryPhone']),
    whatsapp: findStringDeep(record, ['whatsapp', 'whatsappPhone']),
    extensionNumber: findStringDeep(record, ['extensionNumber', 'internalNumber']),
    linkedin: findStringDeep(record, ['linkedin', 'linkedInUrl', 'linkedinUrl']) || pickSocialUrlFromRecord(record, 'linkedin'),
    facebook: findStringDeep(record, ['facebook', 'facebookUrl']) || pickSocialUrlFromRecord(record, 'facebook'),
    instagram: findStringDeep(record, ['instagram', 'instagramUrl']) || pickSocialUrlFromRecord(record, 'instagram'),
    isActive: rawIsActive === undefined ? true : asBoolean(rawIsActive, true),
    canEdit: rawCanEdit === undefined ? true : asBoolean(rawCanEdit, true),
    photo: findStringDeep(record, ['photoData', 'photo', 'avatar']),
    photoUrl: findStringDeep(record, ['photoUrl', 'photoData', 'photo', 'avatar']),
    photoData: findStringDeep(record, ['photoData', 'photoBase64', 'profilePhotoData']),
    cardBackground: findStringDeep(record, ['cardBackground', 'cardBackgroundUrl', 'backgroundUrl', 'backgroundImageUrl']),
    cardBackgroundUrl: findStringDeep(record, ['cardBackgroundUrl', 'cardBackground', 'backgroundUrl', 'backgroundImageUrl']),
    additionalInfo: findStringDeep(record, ['additionalInfo', 'description', 'bio', 'about']),
    dateOfBirth: findStringDeep(record, ['dateOfBirth', 'birthDate', 'birthday', 'dob']),
    address: findStringDeep(record, ['address', 'homeAddress', 'residentialAddress', 'location']),
    googleMapsUrl: findStringDeep(record, ['googleMapsUrl', 'mapsUrl', 'mapUrl', 'addressUrl']),
    socialAccounts: Array.isArray(record.socialAccounts) ? record.socialAccounts as LocalEmployeeAccount['socialAccounts'] : undefined,
    scans: asNumber(record.scans || record.scanCount, 0),
    mustChangePassword,
    firstLogin: mustChangePassword,
    isFirstLogin: mustChangePassword,
    forcePasswordChange: mustChangePassword,
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
};

export const readLocalEmployeeAccounts = (): LocalEmployeeAccount[] => {
  const normalized = readArray<LocalEmployeeAccount | AnyRecord>(EMPLOYEE_STORAGE_KEY)
    .map(normalizeLocalEmployeeAccount)
    .filter((item): item is LocalEmployeeAccount => Boolean(item));

  const unique = normalized.reduce<LocalEmployeeAccount[]>((acc, employee) => {
    const email = normalizeEmail(employee.email);
    const voen = normalizeVoen(employee.voen);
    const existingIndex = acc.findIndex((item) => {
      const sameId = item.id && employee.id && item.id === employee.id;
      const sameEmailCompany = normalizeEmail(item.email) === email && normalizeVoen(item.voen) === voen;
      const sameEmailWithoutCompany = !voen && !normalizeVoen(item.voen) && normalizeEmail(item.email) === email;
      return sameId || sameEmailCompany || sameEmailWithoutCompany;
    });

    if (existingIndex === -1) acc.push(employee);
    else acc[existingIndex] = { ...acc[existingIndex], ...employee };

    return acc;
  }, []);

  return unique.map(applyLocalEmployeeOverrideToAccount);
};

export const saveLocalEmployeeAccount = (account: LocalEmployeeAccount) => {
  const employees = readLocalEmployeeAccounts();
  const email = normalizeEmail(account.email);
  const voen = normalizeVoen(account.voen);
  const id = account.id || email || crypto.randomUUID();

  const nextAccount: LocalEmployeeAccount = {
    ...account,
    id,
    email,
    voen,
    scans: asNumber(account.scans, 0),
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const withoutOld = employees.filter((item) => {
    return item.id !== id && !(normalizeEmail(item.email) === email && normalizeVoen(item.voen) === voen);
  });

  saveArray(EMPLOYEE_STORAGE_KEY, [...withoutOld, nextAccount]);
};

export const getLocalEmployeesForCompany = (companyId?: string, voen?: string): LocalEmployeeAccount[] => {
  const cleanCompanyId = (companyId || '').trim();
  const cleanVoen = normalizeVoen(voen || '');

  return readLocalEmployeeAccounts().filter((employee) => {
    const sameCompanyId = cleanCompanyId && employee.companyId === cleanCompanyId;
    const sameVoen = cleanVoen && normalizeVoen(employee.voen) === cleanVoen;
    return sameCompanyId || sameVoen;
  });
};

export const findLocalEmployeeAccount = (
  email: string,
  password: string,
  voen: string
): LocalEmployeeAccount | null => {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = password.trim();
  const cleanVoen = normalizeVoen(voen);

  if (!cleanEmail || !cleanPassword || !cleanVoen) return null;

  const sameCredentials = readLocalEmployeeAccounts().filter((employee) => {
    return (
      normalizeEmail(employee.email) === cleanEmail &&
      employee.password === cleanPassword &&
      employee.isActive !== false
    );
  });

  const exactVoen = sameCredentials.find((employee) => normalizeVoen(employee.voen) === cleanVoen);
  if (exactVoen) return exactVoen;

  const missingVoen = sameCredentials.find((employee) => !normalizeVoen(employee.voen));
  if (missingVoen && sameCredentials.length === 1) return { ...missingVoen, voen: cleanVoen };

  if (sameCredentials.length === 1) return sameCredentials[0];

  return null;
};

export const findLocalEmployeeById = (id: string): LocalEmployeeAccount | null => {
  const cleanId = id.trim();
  const cleanEmail = normalizeEmail(id || '');
  if (!cleanId && !cleanEmail) return null;
  return readLocalEmployeeAccounts().find((employee) => employee.id === cleanId || normalizeEmail(employee.email) === cleanEmail) || null;
};

export const updateLocalEmployeePassword = (
  idOrEmail: string,
  voen: string,
  newPassword: string
): LocalEmployeeAccount | null => {
  const cleanId = idOrEmail.trim();
  const cleanEmail = normalizeEmail(idOrEmail || '');
  const cleanVoen = normalizeVoen(voen || '');
  const cleanPassword = newPassword.trim();

  if ((!cleanId && !cleanEmail) || !cleanPassword) return null;

  const employees = readLocalEmployeeAccounts();
  const index = employees.findIndex((employee) => {
    const sameId = cleanId && employee.id === cleanId;
    const sameEmail = cleanEmail && normalizeEmail(employee.email) === cleanEmail;
    const sameVoen = !cleanVoen || normalizeVoen(employee.voen) === cleanVoen;
    return (sameId || sameEmail) && sameVoen;
  });

  if (index === -1) return null;

  const updated: LocalEmployeeAccount = {
    ...employees[index],
    password: cleanPassword,
    mustChangePassword: false,
    firstLogin: false,
    isFirstLogin: false,
    forcePasswordChange: false,
    updatedAt: new Date().toISOString(),
  };

  saveArray(EMPLOYEE_STORAGE_KEY, employees.map((employee, currentIndex) => currentIndex === index ? updated : employee));
  return updated;
};

export const updateLocalEmployeeById = (
  id: string,
  patch: Partial<LocalEmployeeAccount>
): LocalEmployeeAccount | null => {
  const employees = readLocalEmployeeAccounts();
  const cleanId = id.trim();
  const cleanEmail = normalizeEmail(id);

  const employeeIndex = employees.findIndex((employee) => {
    return employee.id === cleanId || normalizeEmail(employee.email) === cleanEmail;
  });

  if (employeeIndex === -1) return null;

  const currentEmployee = employees[employeeIndex];

  const updated: LocalEmployeeAccount = {
    ...currentEmployee,
    ...patch,
    id: currentEmployee.id,
    email: normalizeEmail(patch.email || currentEmployee.email),
    voen: normalizeVoen(patch.voen || currentEmployee.voen),
    scans: asNumber(patch.scans ?? currentEmployee.scans, 0),
    updatedAt: new Date().toISOString(),
  };

  const next = employees.map((employee, index) =>
    index === employeeIndex ? updated : employee
  );

  saveArray(EMPLOYEE_STORAGE_KEY, next);

  const overridePatch: Partial<LocalEmployeeOverride> = {
    id: updated.id,
    email: updated.email,
    companyId: updated.companyId,
    companyVoen: updated.voen,
  };

  const profileFields: Array<keyof LocalEmployeeOverride> = [
    'firstName',
    'lastName',
    'middleName',
    'jobTitle',
    'phone1',
    'phone2',
    'whatsapp',
    'extensionNumber',
    'linkedin',
    'facebook',
    'instagram',
    'photo',
    'photoUrl',
    'photoData',
    'additionalInfo',
    'dateOfBirth',
    'address',
    'googleMapsUrl',
  ];

  profileFields.forEach((field) => {
    const value = updated[field as keyof LocalEmployeeAccount];
    if (value !== undefined) {
      (overridePatch as Record<string, unknown>)[field] = value;
    }
  });

  if (patch.isActive !== undefined) {
    overridePatch.isActive = updated.isActive;
  }

  if (patch.canEdit !== undefined) {
    overridePatch.canEdit = updated.canEdit;
  }

  saveLocalEmployeeOverride(overridePatch);

  return updated;
};

export const addLocalAuditLog = (input: Omit<LocalAuditLog, 'id' | 'date'> & { date?: string }) => {
  const logs = readLocalAuditLogs();
  const row: LocalAuditLog = {
    id: crypto.randomUUID(),
    date: input.date || new Date().toISOString(),
    userName: input.userName,
    userId: input.userId,
    actionType: input.actionType,
    entity: input.entity,
    beforeValue: input.beforeValue,
    afterValue: input.afterValue,
    details: input.details,
    companyId: input.companyId,
    companyVoen: input.companyVoen,
  };

  saveArray(AUDIT_STORAGE_KEY, [row, ...logs].slice(0, 200));
  return row;
};

export const readLocalAuditLogs = (companyId?: string, voen?: string): LocalAuditLog[] => {
  const cleanCompanyId = (companyId || '').trim();
  const cleanVoen = normalizeVoen(voen || '');
  const logs = readArray<LocalAuditLog>(AUDIT_STORAGE_KEY);

  if (!cleanCompanyId && !cleanVoen) return logs;

  return logs.filter((log) => {
    return (cleanCompanyId && log.companyId === cleanCompanyId) || (cleanVoen && log.companyVoen === cleanVoen);
  });
};

export const employeeToRecord = (employee: LocalEmployeeAccount): AnyRecord => ({
  id: employee.id,
  userId: employee.id,
  employeeId: employee.id,
  companyId: employee.companyId,
  companyName: employee.companyName,
  voen: employee.voen,
  firstName: employee.firstName,
  lastName: employee.lastName,
  middleName: employee.middleName || '',
  jobTitle: employee.jobTitle,
  position: employee.jobTitle,
  phone1: employee.phone1,
  phone2: employee.phone2 || '',
  whatsapp: employee.whatsapp || '',
  extensionNumber: employee.extensionNumber || '',
  email: employee.email,
  linkedin: employee.linkedin || '',
  linkedInUrl: employee.linkedin || '',
  facebook: employee.facebook || '',
  facebookUrl: employee.facebook || '',
  instagram: employee.instagram || '',
  instagramUrl: employee.instagram || '',
  socialAccounts: buildSocialAccountsRecord(employee),
  socials: buildSocialAccountsRecord(employee),
  isActive: employee.isActive,
  canEdit: employee.canEdit,
  canEditProfile: employee.canEdit,
  canUpdate: employee.canEdit,
  editPermission: employee.canEdit,
  editable: employee.canEdit,
  photo: employee.photo || '',
  photoUrl: employee.photoUrl || employee.photo || '',
  photoData: employee.photoData || (/^data:image\//i.test(employee.photo || '') ? employee.photo : ''),
  cardBackground: employee.cardBackground || employee.cardBackgroundUrl || '',
  cardBackgroundUrl: employee.cardBackgroundUrl || employee.cardBackground || '',
  additionalInfo: employee.additionalInfo || '',
  dateOfBirth: employee.dateOfBirth || '',
  birthDate: employee.dateOfBirth || '',
  address: employee.address || '',
  homeAddress: employee.address || '',
  googleMapsUrl: employee.googleMapsUrl || '',
  mapsUrl: employee.googleMapsUrl || '',
  scans: employee.scans || 0,
  scanCount: employee.scans || 0,
  role: 'employee',
  mustChangePassword: employee.mustChangePassword ?? employee.isFirstLogin ?? employee.firstLogin ?? false,
  firstLogin: employee.firstLogin ?? employee.mustChangePassword ?? employee.isFirstLogin ?? false,
  isFirstLogin: employee.isFirstLogin ?? employee.mustChangePassword ?? employee.firstLogin ?? false,
  forcePasswordChange: employee.forcePasswordChange ?? employee.mustChangePassword ?? employee.firstLogin ?? false,
  company: {
    id: employee.companyId,
    companyId: employee.companyId,
    name: employee.companyName,
    companyName: employee.companyName,
    voen: employee.voen,
  },
});

export const getCurrentCompanyEmployees = () => {
  const storedUser = getStoredUser();
  const companyId = storedUser?.companyId || '';
  const voen = storedUser?.companyVoen || '';
  return getLocalEmployeesForCompany(companyId, voen);
};

export const getLocalAnalytics = () => {
  const employees = getCurrentCompanyEmployees();
  const storedUser = getStoredUser();
  const logs = readLocalAuditLogs(storedUser?.companyId || '', storedUser?.companyVoen || '');
  const totalScans = employees.reduce((sum, employee) => sum + asNumber(employee.scans, 0), 0);

  return {
    totalScans,
    chart: [
      {
        date: new Date().toISOString().slice(0, 10),
        count: totalScans,
        scanCount: totalScans,
      },
    ],
    ranking: employees.map((employee) => ({
      key: employee.id,
      employee: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      userName: `${employee.firstName} ${employee.lastName}`.trim(),
      user: employee.email,
      scans: asNumber(employee.scans, 0),
      scanCount: asNumber(employee.scans, 0),
    })),
    scanLogs: logs
      .map((log) => ({
        key: log.id,
        date: log.date,
        createdAt: log.date,
        userName: log.userName,
        user: log.userName,
        details: log.details,
      })),
  };
};

export const localEmployeeAccountInfo = (employee: LocalEmployeeAccount): Record<string, unknown> => ({
  id: employee.id,
  userId: employee.id,
  employeeId: employee.id,
  email: employee.email,
  gmail: employee.email,
  name: `${employee.firstName} ${employee.lastName}`.trim(),
  fullName: `${employee.firstName} ${employee.lastName}`.trim(),
  firstName: employee.firstName,
  lastName: employee.lastName,
  middleName: employee.middleName || '',
  jobTitle: employee.jobTitle,
  position: employee.jobTitle,
  role: 'employee',
  companyId: employee.companyId,
  companyVoen: employee.voen,
  voen: employee.voen,
  companyName: employee.companyName,
  phone1: employee.phone1 || '',
  phone: employee.phone1 || '',
  phoneNumber: employee.phone1 || '',
  phone2: employee.phone2 || '',
  whatsapp: employee.whatsapp || '',
  whatsappPhone: employee.whatsapp || '',
  extensionNumber: employee.extensionNumber || '',
  internalNumber: employee.extensionNumber || '',
  linkedin: employee.linkedin || '',
  linkedInUrl: employee.linkedin || '',
  linkedinUrl: employee.linkedin || '',
  facebook: employee.facebook || '',
  facebookUrl: employee.facebook || '',
  instagram: employee.instagram || '',
  instagramUrl: employee.instagram || '',
  socialAccounts: buildSocialAccountsRecord(employee),
  socials: buildSocialAccountsRecord(employee),
  photo: employee.photo || '',
  photoUrl: employee.photoUrl || employee.photo || '',
  avatar: employee.photoUrl || employee.photo || '',
  cardBackground: employee.cardBackground || employee.cardBackgroundUrl || '',
  cardBackgroundUrl: employee.cardBackgroundUrl || employee.cardBackground || '',
  isActive: employee.isActive,
  canEdit: employee.canEdit,
  canEditProfile: employee.canEdit,
  canUpdate: employee.canEdit,
  editPermission: employee.canEdit,
  editable: employee.canEdit,
  mustChangePassword: employee.mustChangePassword ?? employee.isFirstLogin ?? employee.firstLogin ?? false,
  firstLogin: employee.firstLogin ?? employee.mustChangePassword ?? employee.isFirstLogin ?? false,
  isFirstLogin: employee.isFirstLogin ?? employee.mustChangePassword ?? employee.firstLogin ?? false,
  forcePasswordChange: employee.forcePasswordChange ?? employee.mustChangePassword ?? employee.firstLogin ?? false,
  company: {
    id: employee.companyId,
    companyId: employee.companyId,
    name: employee.companyName,
    companyName: employee.companyName,
    voen: employee.voen,
  },
});
