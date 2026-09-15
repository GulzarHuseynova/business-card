import { normalizeRole } from '../../utils/api.utils';
import { normalizeAssetUrl, normalizeInlineImageData } from '../../utils/asset-url.utils';
import type { NormalizedUser } from '../../types/company.type';

export const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const uselessIdentityValues = new Set(['', '-', '--', 'null', 'undefined', 'n/a', 'na', 'yoxdur', 'yox']);

export const isUsefulIdentity = (value?: string | number | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return Boolean(normalized && !uselessIdentityValues.has(normalized));
};

export const normalizeIdentityPart = (value?: string | number | null) => String(value ?? '').trim().toLowerCase();
export const normalizeEmailIdentity = (value?: string | number | null) => normalizeIdentityPart(value);
export const normalizePhoneIdentity = (value?: string | number | null) => normalizeIdentityPart(value).replace(/\D/g, '');
export const isEmailIdentity = (value?: string | number | null) => /@/.test(String(value ?? ''));

export const isSuperAdminUser = (user: Partial<NormalizedUser>) => {
  const role = normalizeRole(user.role);
  const email = normalizeEmailIdentity(user.email);
  const jobTitle = normalizeIdentityPart(user.jobTitle);
  const fullName = [user.firstName, user.lastName, user.middleName]
    .map(normalizeIdentityPart)
    .filter(Boolean)
    .join(' ');

  return (
    role === 'super-admin' ||
    email === 'admin@setclapp.com' ||
    (fullName.includes('super') && fullName.includes('admin')) ||
    (jobTitle.includes('system') && jobTitle.includes('admin'))
  );
};

export const filterCompanyUsers = (users: NormalizedUser[]) => users.filter((user) => !isSuperAdminUser(user));

export const getFullNameIdentity = (user: Partial<NormalizedUser>) => {
  return [user.firstName, user.lastName, user.middleName]
    .map(normalizeIdentityPart)
    .filter((part) => part && !uselessIdentityValues.has(part))
    .join('|');
};

export const hasSameEmail = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftEmail = normalizeEmailIdentity(left.email);
  const rightEmail = normalizeEmailIdentity(right.email);
  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail && isEmailIdentity(leftEmail));
};

export const hasDifferentUsefulEmails = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftEmail = normalizeEmailIdentity(left.email);
  const rightEmail = normalizeEmailIdentity(right.email);
  return Boolean(leftEmail && rightEmail && isEmailIdentity(leftEmail) && isEmailIdentity(rightEmail) && leftEmail !== rightEmail);
};

export const hasSameUsefulId = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftId = normalizeIdentityPart(left.id);
  const rightId = normalizeIdentityPart(right.id);
  return Boolean(leftId && rightId && leftId === rightId && !isEmailIdentity(leftId));
};

export const hasSameQr = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftQr = normalizeIdentityPart(left.qrUid || left.cardUid);
  const rightQr = normalizeIdentityPart(right.qrUid || right.cardUid);
  return Boolean(leftQr && rightQr && leftQr === rightQr && !isEmailIdentity(leftQr));
};

export const hasSamePhone = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftPhone = normalizePhoneIdentity(left.phone1);
  const rightPhone = normalizePhoneIdentity(right.phone1);
  return Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
};

export const hasSameName = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftName = getFullNameIdentity(left);
  const rightName = getFullNameIdentity(right);
  return Boolean(leftName && rightName && leftName === rightName);
};

export const hasSameJob = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  const leftJob = normalizeIdentityPart(left.jobTitle);
  const rightJob = normalizeIdentityPart(right.jobTitle);
  return Boolean(leftJob && rightJob && leftJob === rightJob && !uselessIdentityValues.has(leftJob));
};

export const isSameUser = (left: Partial<NormalizedUser>, right: Partial<NormalizedUser>) => {
  if (hasSameEmail(left, right)) return true;
  if (hasDifferentUsefulEmails(left, right)) return false;

  const sameName = hasSameName(left, right);
  if (hasSameUsefulId(left, right)) return true;
  if (hasSameQr(left, right)) return true;
  if (sameName && hasSamePhone(left, right)) return true;

  const oneSideEmailMissing = !isEmailIdentity(left.email) || !isEmailIdentity(right.email);
  if (sameName && hasSameJob(left, right) && oneSideEmailMissing) return true;

  return false;
};

export const pickUsefulString = (current?: string, next?: string) => {
  const currentText = String(current ?? '').trim();
  const nextText = String(next ?? '').trim();
  const currentUseful = isUsefulIdentity(currentText);
  const nextUseful = isUsefulIdentity(nextText);

  if (nextUseful) return nextText;
  if (currentUseful) return currentText;
  return nextText || currentText;
};

export const pickEmail = (current?: string, next?: string) => {
  const currentEmail = normalizeEmailIdentity(current);
  const nextEmail = normalizeEmailIdentity(next);

  if (isEmailIdentity(nextEmail)) return nextEmail;
  if (isEmailIdentity(currentEmail)) return currentEmail;
  return pickUsefulString(current, next);
};

export const pickUsefulAsset = (current?: string, next?: string) => {
  const nextAsset = normalizeAssetUrl(next);
  if (nextAsset) return nextAsset;

  const currentAsset = normalizeAssetUrl(current);
  if (currentAsset) return currentAsset;

  return '';
};

export const pickId = (current?: string, next?: string, email?: string) => {
  const currentId = normalizeIdentityPart(current);
  const nextId = normalizeIdentityPart(next);

  if (isUsefulIdentity(currentId) && !isEmailIdentity(currentId)) return currentId;
  if (isUsefulIdentity(nextId) && !isEmailIdentity(nextId)) return nextId;
  return pickUsefulString(currentId, nextId) || email || crypto.randomUUID();
};

export const mergeUserRecords = (current: NormalizedUser, next: NormalizedUser): NormalizedUser => {
  const email = pickEmail(current.email, next.email);
  const photoData = normalizeInlineImageData(next.photoData || next.photo || next.photoUrl)
    || normalizeInlineImageData(current.photoData || current.photo || current.photoUrl);
  const remotePhoto = pickUsefulAsset(current.photoUrl, next.photoUrl);
  const displayPhoto = photoData || pickUsefulAsset(current.photo, next.photo) || remotePhoto;

  return {
    ...current,
    ...next,
    id: pickId(current.id, next.id, email),
    email,
    firstName: pickUsefulString(current.firstName, next.firstName),
    lastName: pickUsefulString(current.lastName, next.lastName),
    middleName: pickUsefulString(current.middleName, next.middleName),
    jobTitle: pickUsefulString(current.jobTitle, next.jobTitle),
    phone1: pickUsefulString(current.phone1, next.phone1),
    phone2: pickUsefulString(current.phone2, next.phone2),
    extensionNumber: pickUsefulString(current.extensionNumber, next.extensionNumber),
    companyId: pickUsefulString(current.companyId, next.companyId),
    companyName: pickUsefulString(current.companyName, next.companyName),
    companyVoen: pickUsefulString(current.companyVoen, next.companyVoen),
    qrUid: pickUsefulString(current.qrUid, next.qrUid),
    qrCode: pickUsefulString(current.qrCode, next.qrCode),
    cardUid: pickUsefulString(current.cardUid, next.cardUid),
    photo: displayPhoto,
    photoUrl: displayPhoto,
    photoData,
    whatsapp: pickUsefulString(current.whatsapp, next.whatsapp),
    linkedin: pickUsefulString(current.linkedin, next.linkedin),
    facebook: pickUsefulString(current.facebook, next.facebook),
    instagram: pickUsefulString(current.instagram, next.instagram),
    additionalInfo: pickUsefulString(current.additionalInfo, next.additionalInfo),
    dateOfBirth: pickUsefulString(current.dateOfBirth, next.dateOfBirth),
    address: pickUsefulString(current.address, next.address),
    googleMapsUrl: pickUsefulString(current.googleMapsUrl, next.googleMapsUrl),
    cardBackgroundUrl: pickUsefulAsset(current.cardBackgroundUrl, next.cardBackgroundUrl),
    socialAccounts: next.socialAccounts?.length ? next.socialAccounts : current.socialAccounts,
    isActive: next.isActive,
    canEdit: next.canEdit,
    role: next.role || current.role,
  };
};

export const mergeNormalizedUsers = (...lists: NormalizedUser[][]) => {
  return lists.flat().reduce<NormalizedUser[]>((acc, user) => {
    const existingIndex = acc.findIndex((row) => isSameUser(row, user));

    if (existingIndex === -1) {
      acc.push(user);
      return acc;
    }

    acc[existingIndex] = mergeUserRecords(acc[existingIndex], user);
    return acc;
  }, []);
};
