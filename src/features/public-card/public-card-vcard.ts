import { API_TARGET_URL } from '../../api/client';
import type { PublicCardProfile } from '../../types/public-card.type';
import { downloadBlob, getFullName } from './public-card-shared';

const escapeVCard = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const normalizeBirthDate = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const localMatch = text.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  return text;
};

const foldVCardLine = (line: string) => {
  if (line.length <= 74) return [line];

  const lines: string[] = [line.slice(0, 74)];
  for (let index = 74; index < line.length; index += 73) {
    lines.push(` ${line.slice(index, index + 73)}`);
  }
  return lines;
};

const photoLines = (photo: string) => {
  const value = String(photo || '').trim();
  if (!value) return [];

  const inline = value.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/i);
  if (!inline) return [];

  const imageType = inline[1].toUpperCase() === 'JPG' ? 'JPEG' : inline[1].toUpperCase();
  const base64 = inline[2].replace(/\s+/g, '');

  return foldVCardLine(`PHOTO;TYPE=${imageType};ENCODING=BASE64:${base64}`);
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('VCF şəkli oxuna bilmədi.'));
  image.src = source;
});

const getPhotoFetchCandidates = (source: string) => {
  const candidates: string[] = [];
  const add = (value: string) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  try {
    const parsed = new URL(source, typeof window !== 'undefined' ? window.location.origin : API_TARGET_URL);
    const target = API_TARGET_URL ? new URL(API_TARGET_URL) : null;
    if (target && parsed.origin === target.origin) add(`${parsed.pathname}${parsed.search}`);
  } catch {
    // source data/blob/relative URL ola bilər; aşağıdakı birbaşa namizəd kifayətdir.
  }

  add(source);
  return candidates;
};

const fetchPhotoBlob = async (source: string) => {
  let lastError: unknown = new Error('VCF şəkli yüklənmədi.');

  for (const candidate of getPhotoFetchCandidates(source)) {
    try {
      const response = await fetch(candidate, { credentials: 'include' });
      if (!response.ok) throw new Error(`VCF şəkli yüklənmədi: ${response.status}`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('VCF şəkil cavabı şəkil formatında deyil.');
      return blob;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const base64Size = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const imageToCompactJpeg = (image: HTMLImageElement) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error('VCF şəkil ölçüsü tapılmadı.');

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('VCF şəkli çevrilə bilmədi.');

  const maxBytes = 384 * 1024;
  const attempts = [
    { side: 1024, quality: 0.94 },
    { side: 900, quality: 0.92 },
    { side: 800, quality: 0.9 },
    { side: 720, quality: 0.88 },
    { side: 640, quality: 0.86 },
  ];

  let result = '';
  for (const attempt of attempts) {
    const side = attempt.side;
    canvas.width = side;
    canvas.height = side;
    context.clearRect(0, 0, side, side);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, side, side);

    const coverScale = Math.max(side / sourceWidth, side / sourceHeight);
    const coverWidth = sourceWidth * coverScale;
    const coverHeight = sourceHeight * coverScale;
    context.save();
    context.globalAlpha = 0.18;
    context.filter = `blur(${Math.max(12, Math.round(side * 0.025))}px)`;
    context.drawImage(
      image,
      (side - coverWidth) / 2,
      (side - coverHeight) / 2,
      coverWidth,
      coverHeight,
    );
    context.restore();

    // Əsas şəkil contain prinsipi ilə yerləşir: heç bir tərəf kəsilmir.
    const contentSide = side * 0.94;
    const containScale = Math.min(contentSide / sourceWidth, contentSide / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * containScale));
    const height = Math.max(1, Math.round(sourceHeight * containScale));
    context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);

    result = canvas.toDataURL('image/jpeg', attempt.quality);
    if (base64Size(result) <= maxBytes) break;
  }

  return result;
};

const resolveEmbeddedPhoto = async (photo: string) => {
  const source = String(photo || '').trim();
  if (!source || typeof document === 'undefined') return '';

  let objectUrl = '';

  try {
    const blob = await fetchPhotoBlob(source);
    objectUrl = URL.createObjectURL(blob);
    const image = await loadImage(objectUrl);
    return imageToCompactJpeg(image);
  } catch {
    // Artıq uyğun inline JPEG/PNG-dirsə ən azı həmin məlumatı VCF-də saxla.
    return /^data:image\/(?:jpeg|jpg|png);base64,/i.test(source) ? source : '';
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

export const buildVCard = (profile: PublicCardProfile) => {
  const fullName = getFullName(profile);
  const birthDate = normalizeBirthDate(profile.dateOfBirth);
  const homeAddress = String(profile.address || '').trim();
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCard(profile.lastName)};${escapeVCard(profile.firstName)};${escapeVCard(profile.middleName)};;`,
    `FN:${escapeVCard(fullName)}`,
  ];

  if (profile.companyName) lines.push(`ORG:${escapeVCard(profile.companyName)}`);
  if (profile.jobTitle) lines.push(`TITLE:${escapeVCard(profile.jobTitle)}`);
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVCard(profile.email)}`);
  if (birthDate) lines.push(`BDAY:${escapeVCard(birthDate)}`);

  if (homeAddress) {
    lines.push(`ADR;TYPE=HOME:;;${escapeVCard(homeAddress)};;;;`);
    lines.push(`LABEL;TYPE=HOME:${escapeVCard(homeAddress)}`);
  }

  profile.phones.forEach((phone) => {
    if (!phone.number) return;
    const type = phone.type.toLowerCase().includes('whatsapp') ? 'CELL' : 'WORK';
    lines.push(`TEL;TYPE=${type}:${escapeVCard(phone.number)}`);
  });

  profile.socials.forEach((social) => {
    if (social.url) lines.push(`URL;TYPE=${escapeVCard(social.platform)}:${escapeVCard(social.url)}`);
  });

  if (profile.cardUrl) lines.push(`URL;TYPE=Digital Card:${escapeVCard(profile.cardUrl)}`);
  lines.push(...photoLines(profile.photo));
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
};

export const buildOfflineQrVCard = (profile: PublicCardProfile) => {
  return buildVCard({
    ...profile,
    photo: '',
    cardUrl: '',
    socials: [],
    extras: [],
  });
};

export const downloadVCard = async (profile: PublicCardProfile) => {
  const embeddedPhoto = await resolveEmbeddedPhoto(profile.photo);
  const blob = new Blob([
    buildVCard({
      ...profile,
      photo: embeddedPhoto,
    }),
  ], { type: 'text/vcard;charset=utf-8' });
  const fileName = `${getFullName(profile).replace(/\s+/g, '-').toLowerCase()}-contact.vcf`;
  downloadBlob(blob, fileName);
};
