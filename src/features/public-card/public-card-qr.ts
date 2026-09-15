import { Ecc, QrCode } from '@rc-component/qrcode/es/libs/qrcodegen';
import type { PublicCardProfile, QrDownloadFormat } from '../../types/public-card.type';
import { downloadBlob, getFullName } from './public-card-shared';
import { buildOfflineQrVCard } from './public-card-vcard';

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const getSafeQrDownloadFileName = (profile: PublicCardProfile, extension: 'png' | 'svg' | 'pdf') => {
  const baseName = getFullName(profile) || profile.email || profile.id || 'qr';
  const safeName = baseName
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'qr';

  return `${safeName}-${profile.id.slice(0, 8)}-contact-qr.${extension}`;
};

const getQrModules = (payload: string) => {
  return QrCode.encodeText(payload, Ecc.MEDIUM).getModules();
};

const buildQrSvg = (payload: string, size = 600) => {
  const modules = getQrModules(payload);
  const margin = 4;
  const cellCount = modules.length + margin * 2;
  const rects: string[] = [];

  modules.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      rects.push(`<rect x="${x + margin}" y="${y + margin}" width="1" height="1"/>`);
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${cellCount} ${cellCount}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="#111827">${rects.join('')}</g>
</svg>`;
};

const buildQrPngBlob = async (payload: string, size = 600) => {
  const modules = getQrModules(payload);
  const margin = 4;
  const cellCount = modules.length + margin * 2;
  const scale = size / cellCount;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas QR yaradıla bilmədi.');
  }

  canvas.width = size;
  canvas.height = size;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#111827';

  modules.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      context.fillRect(
        Math.round((x + margin) * scale),
        Math.round((y + margin) * scale),
        Math.ceil(scale),
        Math.ceil(scale),
      );
    });
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('PNG QR faylı yaradıla bilmədi.'));
    }, 'image/png');
  });
};

export const getQrPayload = (profile: PublicCardProfile) => buildOfflineQrVCard(profile);

export const buildQrDownloadBlob = async (profile: PublicCardProfile, format: 'png' | 'svg') => {
  const payload = getQrPayload(profile);
  const fileName = getSafeQrDownloadFileName(profile, format);

  if (format === 'svg') {
    return {
      blob: new Blob([buildQrSvg(payload)], { type: 'image/svg+xml;charset=utf-8' }),
      fileName,
    };
  }

  return {
    blob: await buildQrPngBlob(payload),
    fileName,
  };
};

export const downloadQrImage = async (profile: PublicCardProfile, format: 'png' | 'svg') => {
  const { blob, fileName } = await buildQrDownloadBlob(profile, format);
  downloadBlob(blob, fileName);
};

const createCrc32Table = () => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let current = index;

    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }

    table[index] = current >>> 0;
  }

  return table;
};

const CRC32_TABLE = createCrc32Table();
const textEncoder = new TextEncoder();

const getCrc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
};

const pushUint16 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff);
};

const pushUint32 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};

const concatBytes = (parts: Uint8Array[]) => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
};

const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const toZipSafeFileName = (fileName: string, fallback: string) => {
  const cleaned = (fileName || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
};

const createZipBlob = async (files: { fileName: string; blob: Blob }[]) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { dosDate, dosTime } = getDosDateTime();

  for (const file of files) {
    const data = await blobToBytes(file.blob);
    const fileNameBytes = textEncoder.encode(file.fileName);
    const crc = getCrc32(data);
    const localHeader: number[] = [];

    pushUint32(localHeader, 0x04034b50);
    pushUint16(localHeader, 20);
    pushUint16(localHeader, 0x0800);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, dosTime);
    pushUint16(localHeader, dosDate);
    pushUint32(localHeader, crc);
    pushUint32(localHeader, data.length);
    pushUint32(localHeader, data.length);
    pushUint16(localHeader, fileNameBytes.length);
    pushUint16(localHeader, 0);

    const localRecord = concatBytes([new Uint8Array(localHeader), fileNameBytes, data]);
    localParts.push(localRecord);

    const centralHeader: number[] = [];
    pushUint32(centralHeader, 0x02014b50);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 0x0800);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, dosTime);
    pushUint16(centralHeader, dosDate);
    pushUint32(centralHeader, crc);
    pushUint32(centralHeader, data.length);
    pushUint32(centralHeader, data.length);
    pushUint16(centralHeader, fileNameBytes.length);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint32(centralHeader, 0);
    pushUint32(centralHeader, offset);

    centralParts.push(concatBytes([new Uint8Array(centralHeader), fileNameBytes]));
    offset += localRecord.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord: number[] = [];
  pushUint32(endRecord, 0x06054b50);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, files.length);
  pushUint16(endRecord, files.length);
  pushUint32(endRecord, centralDirectory.length);
  pushUint32(endRecord, offset);
  pushUint16(endRecord, 0);

  return new Blob([concatBytes([...localParts, centralDirectory, new Uint8Array(endRecord)])], {
    type: 'application/zip',
  });
};

export const downloadFilesAsZip = async (
  files: { fileName: string; blob: Blob }[],
  zipFileName = 'qr-kodlar.zip',
) => {
  const nameCounts = new Map<string, number>();
  const uniqueFiles = files.map((file, index) => {
    const safeName = toZipSafeFileName(file.fileName, `qr-${index + 1}.png`);
    const dotIndex = safeName.lastIndexOf('.');
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const extension = dotIndex > 0 ? safeName.slice(dotIndex) : '';
    const currentCount = nameCounts.get(safeName) || 0;
    nameCounts.set(safeName, currentCount + 1);

    return {
      blob: file.blob,
      fileName: currentCount === 0 ? safeName : `${base}-${currentCount + 1}${extension}`,
    };
  });

  downloadBlob(await createZipBlob(uniqueFiles), zipFileName);
};

export const openQrPdfPrintPage = (profiles: PublicCardProfile[] | PublicCardProfile) => {
  const rows = Array.isArray(profiles) ? profiles : [profiles];
  const cards = rows.map((profile) => {
    const name = getFullName(profile);
    const qrDescription = 'Şəkilsiz kontakt QR · internetlə və internetsiz işləyir';
    const qrSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildQrSvg(getQrPayload(profile), 320))}`;
    return `
      <article class="card">
        ${profile.companyLogo ? `<img class="logo" src="${escapeHtml(profile.companyLogo)}" alt="logo" />` : ''}
        <h2>${escapeHtml(name)}</h2>
        ${profile.jobTitle ? `<p>${escapeHtml(profile.jobTitle)}</p>` : ''}
        ${profile.companyName ? `<strong>${escapeHtml(profile.companyName)}</strong>` : ''}
        <img class="qr" src="${qrSvg}" alt="QR" />
        <small>${escapeHtml(qrDescription)}</small>
      </article>
    `;
  }).join('');

  const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>QR PDF</title>
<style>
body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.card{page-break-inside:avoid;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;text-align:center;box-shadow:0 10px 30px rgba(15,23,42,.08)}.logo{max-height:46px;max-width:140px;object-fit:contain;margin-bottom:8px}.qr{width:220px;height:220px;margin:14px auto;display:block}h2{font-size:20px;margin:8px 0 4px}p{margin:0 0 4px;color:#475569}small{word-break:break-all;color:#64748b}@media print{body{background:#fff}.card{box-shadow:none}}
</style></head><body><button onclick="window.print()" style="margin-bottom:16px;padding:10px 14px;border-radius:10px;border:1px solid #c7d2fe;background:#eef2ff;color:#312e81;font-weight:700;cursor:pointer">PDF kimi saxla / çap et</button><div class="grid">${cards}</div></body></html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    downloadBlob(new Blob([page], { type: 'text/html;charset=utf-8' }), 'qr-print-page.html');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(page);
  printWindow.document.close();
};

export const downloadQrByFormat = async (profile: PublicCardProfile, format: QrDownloadFormat) => {
  if (format === 'pdf') {
    openQrPdfPrintPage(profile);
    return;
  }

  await downloadQrImage(profile, format);
};
