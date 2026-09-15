import type { CardData } from "../../types/employee.type";
import { findDeep, findObjectDeep, isRecord, unwrapData } from "../../utils/api.utils";
import { normalizeAssetUrl } from "../../utils/asset-url.utils";

export const uuid = () => crypto.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export const EMPTY_CARD: CardData = {
  photo: "",
  companyLogo: "",
  cardBackground: "",
  lastName: "",
  firstName: "",
  middleName: "",
  position: "",
  company: "",
  internalNumber: "",
  phones: [],
  socials: [],
  extras: [],
  nfcUrl: "",
  qrUid: uuid(),
};

export const inputStyle = { borderRadius: 10, height: 38 } as const;

export const iconBox = (bg: string, color: string, size = 38) => ({
  width: size,
  height: size,
  borderRadius: 12,
  flexShrink: 0,
  background: bg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color,
  fontSize: size * 0.45,
} as const);

const INVALID_TEXTS = new Set([
  "", "-", "--", "null", "undefined", "string", "[object object]",
  "n/a", "na", "yoxdur", "yox",
]);

export const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text && !INVALID_TEXTS.has(text.toLowerCase()) ? text : fallback;
};

const toEmployeeRecord = (data: unknown): Record<string, unknown> => {
  const unwrapped = unwrapData(data);
  if (!isRecord(unwrapped)) return {};

  const nested = ["user", "profile", "employee", "card", "accountInfo"]
    .map((key) => unwrapped[key])
    .find(isRecord) || findObjectDeep(unwrapped, ["user", "profile", "employee", "card", "accountInfo"]);

  if (!nested) return unwrapped;

  return {
    ...unwrapped,
    ...nested,
    company: nested.company || unwrapped.company,
  };
};

const isEmailLike = (value: string) => /@/.test(value);

const stableQrUid = (seed: string) => {
  const source = seed || uuid();
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const hex = (hash.toString(16).padStart(8, "0") + source.split("").map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(""))
    .replace(/[^a-f0-9]/gi, "")
    .padEnd(32, "0")
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const pickQrUid = (user: Record<string, unknown>, fallback: CardData) => {
  const explicit = normalizeText(user.qrUid || user.qrUUID || user.qrUuid || user.qrCode || user.cardUid || user.cardUuid || user.uuid);
  const id = normalizeText(user.id || user.userId || user.employeeId || user.cardId);
  const email = normalizeText(user.email || user.mail || user.emailAddress);

  if (explicit && !isEmailLike(explicit)) return explicit;
  if (id && !isEmailLike(id)) return id;
  if (fallback.qrUid && !isEmailLike(fallback.qrUid)) return fallback.qrUid;

  return stableQrUid(email || id || explicit || uuid());
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "aktiv"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "deaktiv"].includes(normalized)) return false;
  }
  return undefined;
};

const readBooleanFlag = (data: unknown, keys: string[]): boolean | undefined => {
  const row = toEmployeeRecord(data);
  const directValues = keys.map((key) => row[key]);
  const deepValue = findDeep(data, keys);

  for (const value of [...directValues, deepValue]) {
    const parsed = parseBoolean(value);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
};

export const canOpenEmployeePage = (data: unknown) => {
  return readBooleanFlag(data, ["isActive", "active", "enabled", "status"]) ?? true;
};

export const canEditEmployeeCard = (data: unknown) => {
  return readBooleanFlag(data, ["canEdit", "canEditProfile", "canedit", "canUpdate", "editPermission", "editable"]) ?? true;
};

export const shortText = (value: string, start = 8, end = 6) => {
  if (!value) return "-";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

const parseAdditionalInfo = (value: unknown) => {
  const result: Record<string, string> = {};
  const text = normalizeText(value);
  if (!text) return result;

  text.split(/[;\n]+/).forEach((part) => {
    const [rawKey, ...rest] = part.split(":");
    const key = normalizeText(rawKey).toLowerCase();
    const itemValue = normalizeText(rest.join(":"));
    if (!key || !itemValue) return;

    if (key.includes("whatsapp") || key === "wp") result.whatsapp = itemValue;
    else if (key.includes("linkedin") || key.includes("linked")) result.linkedin = itemValue;
    else if (key.includes("facebook") || key === "fb") result.facebook = itemValue;
    else if (key.includes("instagram") || key === "insta") result.instagram = itemValue;
    else if (key.includes("phone1") || key.includes("iş") || key.includes("is telefonu") || key.includes("work")) result.phone1 = itemValue;
    else if (key.includes("phone2") || key.includes("şəxsi") || key.includes("sexsi") || key.includes("personal")) result.phone2 = itemValue;
    else if (key.includes("daxili") || key.includes("extension") || key.includes("internal")) result.extensionNumber = itemValue;
  });

  return result;
};

const normalizeRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  }

  if (isRecord(value) && Array.isArray(value.$values)) {
    return normalizeRecordArray(value.$values);
  }

  return [];
};

const socialUrlFromAccount = (social: Record<string, unknown>) => normalizeText(
  social.url || social.link || social.value || social.href || social.profileUrl || social.accountUrl || social.socialUrl
);

const socialPlatformFromAccount = (social: Record<string, unknown>, fallback = "Website") => normalizeText(
  social.platform || social.platformName || social.socialPlatform || social.socialMedia || social.socialMediaName || social.type || social.name || social.label,
  fallback
);

export const mapUserToCard = (data: unknown, fallback: CardData): CardData => {
  const user = toEmployeeRecord(data);
  const company = isRecord(user.company) ? user.company : {};
  const additionalInfo = parseAdditionalInfo(user.additionalInfo || user.extraInfo || user.description || user.details);
  const phone1 = normalizeText(user.phone1 || user.phone || user.phoneNumber || additionalInfo.phone1);
  const phone2 = normalizeText(user.phone2 || user.secondaryPhone || additionalInfo.phone2);
  const whatsapp = normalizeText(user.whatsapp || user.whatsappPhone || additionalInfo.whatsapp);
  const linkedin = normalizeText(user.linkedin || user.linkedInUrl || user.linkedinUrl || additionalInfo.linkedin);
  const facebook = normalizeText(user.facebook || user.facebookUrl || additionalInfo.facebook);
  const instagram = normalizeText(user.instagram || user.instagramUrl || additionalInfo.instagram);

  const arrayPhones = normalizeRecordArray(user.phones)
    .map((phone) => ({ type: normalizeText(phone.type, "İş"), number: normalizeText(phone.number || phone.value) }))
    .filter((phone) => phone.number);

  const mappedPhones = arrayPhones.length > 0 ? arrayPhones : [
    phone1 ? { type: "İş", number: phone1 } : null,
    phone2 ? { type: "Şəxsi", number: phone2 } : null,
    whatsapp ? { type: "WhatsApp", number: whatsapp } : null,
  ].filter(Boolean) as CardData["phones"];

  const socialSource = normalizeRecordArray(user.socialAccounts).length > 0 ? user.socialAccounts : user.socials;
  const arraySocials = normalizeRecordArray(socialSource)
    .map((social) => ({ platform: socialPlatformFromAccount(social), url: socialUrlFromAccount(social) }))
    .filter((social) => social.url);

  const mappedSocials = arraySocials.length > 0 ? arraySocials : [
    linkedin ? { platform: "LinkedIn", url: linkedin } : null,
    facebook ? { platform: "Facebook", url: facebook } : null,
    instagram ? { platform: "Instagram", url: instagram } : null,
  ].filter(Boolean) as CardData["socials"];

  const arrayExtras = normalizeRecordArray(user.extras)
    .map((extra) => ({ label: normalizeText(extra.label), value: normalizeText(extra.value) }))
    .filter((extra) => extra.label && extra.value);

  const email = normalizeText(user.email || user.email1 || user.gmail || user.mail || user.emailAddress);
  const department = normalizeText(user.department || user.departmentName);
  const mappedExtras = arrayExtras.length > 0 ? arrayExtras : [
    email ? { label: "Email", value: email } : null,
    department ? { label: "Departament", value: department } : null,
  ].filter(Boolean) as CardData["extras"];

  const companyLogo = normalizeAssetUrl(
    company.logoUrl || company.logoURL || company.logo || company.logoPath ||
    user.companyLogoUrl || user.companyLogoURL || user.companyLogo || user.logoUrl || user.logo
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return {
    ...fallback,
    photo: normalizeAssetUrl(user.photoUrl || user.photoURL || user.photo || user.avatarUrl || user.avatar || user.profilePhotoUrl) || fallback.photo,
    companyLogo: companyLogo || fallback.companyLogo,
    cardBackground: normalizeAssetUrl(
      user.cardBackgroundUrl || user.cardBackgroundURL || user.cardBackground || user.backgroundUrl || user.backgroundImageUrl
    ) || fallback.cardBackground,
    firstName: normalizeText(user.firstName || user.givenName || user.name, fallback.firstName),
    lastName: normalizeText(user.lastName || user.surname, fallback.lastName),
    middleName: normalizeText(user.middleName || user.fatherName, fallback.middleName),
    position: normalizeText(user.jobTitle || user.position || user.title, fallback.position),
    company: normalizeText(company.name || company.companyName || user.companyName, fallback.company),
    internalNumber: normalizeText(user.extensionNumber || user.internalNumber || additionalInfo.extensionNumber, fallback.internalNumber),
    phones: mappedPhones.length > 0 ? mappedPhones : fallback.phones,
    socials: mappedSocials.length > 0 ? mappedSocials : fallback.socials,
    extras: mappedExtras.length > 0 ? mappedExtras : fallback.extras,
    nfcUrl: normalizeText(user.nfcUrl || user.cardUrl, fallback.nfcUrl || `${origin}/employee/business-card`),
    qrUid: pickQrUid(user, fallback),
  };
};
