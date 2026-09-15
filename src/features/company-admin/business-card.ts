import type { AddUserFormValues, UserData } from '../../types/company-admin.type';

const readImageFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Faylı oxumaq mümkün olmadı.'));
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.readAsDataURL(file);
});

export const fileToDataUrl = async (file: File): Promise<string> => {
  const source = await readImageFileAsDataUrl(file);
  if (!file.type.startsWith('image/') || /svg|gif/i.test(file.type)) return source;

  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(source);
    image.onload = () => {
      const maxSide = 420;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(source);
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.src = source;
  });
};

const csvHeaders = [
  'firstName',
  'lastName',
  'middleName',
  'jobTitle',
  'email',
  'password',
  'phone1',
  'phone2',
  'extensionNumber',
  'whatsapp',
  'linkedin',
  'facebook',
  'instagram',
];

const csvLabelMap: Record<string, string> = {
  firstName: 'Ad',
  lastName: 'Soyad',
  middleName: 'Ata adı',
  jobTitle: 'Vəzifə',
  email: 'Email',
  password: 'Kod/Şifrə',
  phone1: 'İş telefonu',
  phone2: 'Şəxsi telefon',
  extensionNumber: 'Daxili nömrə',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

const swaggerExportHeaders = ['FirstName', 'LastName', 'JobTitle', 'Phone1', 'CompanyName'] as const;

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildSwaggerExportCsv = (employees: UserData[], companyName: string) => {
  const rows = employees.map((user) => [
    user.firstName || '',
    user.lastName || '',
    user.jobTitle || '',
    user.phone1 || '',
    user.companyName || companyName || '',
  ].map(csvEscape).join(','));

  return `\ufeff${swaggerExportHeaders.map(csvEscape).join(',')}\n${rows.join('\n')}`;
};

export const downloadTextFile = (content: string, fileName: string, mime = 'text/csv;charset=utf-8') => {
  const url = window.URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const buildTemplateCsv = () => {
  const example = {
    firstName: 'Nümunə',
    lastName: 'Əməkdaş',
    middleName: '',
    jobTitle: 'Menecer',
    email: 'employee@example.com',
    password: '123456',
    phone1: '+994501112233',
    phone2: '',
    extensionNumber: '101',
    whatsapp: '+994501112233',
    linkedin: '',
    facebook: '',
    instagram: '',
  };

  return `\ufeff${csvHeaders.map((header) => csvEscape(csvLabelMap[header] || header)).join(',')}\n${csvHeaders.map((header) => csvEscape(example[header as keyof typeof example])).join(',')}`;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const normalizeCsvHeader = (value: string) => {
  const normalized = value.replace(/^\ufeff/, '').trim().toLowerCase();
  const entry = Object.entries(csvLabelMap).find(([, label]) => label.toLowerCase() === normalized);

  return entry?.[0] || normalized;
};

export const parseEmployeesCsv = async (file: File): Promise<AddUserFormValues[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});

    return {
      firstName: row.firstName || row.ad || '',
      lastName: row.lastName || row.soyad || '',
      middleName: row.middleName || '',
      jobTitle: row.jobTitle || row.position || row['vəzifə'] || '',
      email: row.email || '',
      password: row.password || row['kod/şifrə'] || row.kod || '',
      phone1: row.phone1 || row['iş telefonu'] || '',
      phone2: row.phone2 || '',
      extensionNumber: row.extensionNumber || '',
      whatsapp: row.whatsapp || '',
      linkedin: row.linkedin || '',
      facebook: row.facebook || '',
      instagram: row.instagram || '',
      isActive: true,
      canEdit: true,
    };
  });
};

export const validateImportedEmployee = (employee: AddUserFormValues, rowNumber: number) => {
  const errors: string[] = [];

  if (!employee.firstName) errors.push(`${rowNumber}. sətir: Ad boşdur`);
  if (!employee.lastName) errors.push(`${rowNumber}. sətir: Soyad boşdur`);
  if (!employee.jobTitle) errors.push(`${rowNumber}. sətir: Vəzifə boşdur`);
  if (!employee.email) errors.push(`${rowNumber}. sətir: Email boşdur`);
  if (!employee.password) errors.push(`${rowNumber}. sətir: Kod/şifrə boşdur`);
  if (!employee.phone1) errors.push(`${rowNumber}. sətir: İş telefonu boşdur`);

  return errors;
};

const isUsefulRowKey = (value?: string | number | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();

  return Boolean(
    normalized &&
    !['-', '--', 'null', 'undefined', 'n/a', 'na', 'yoxdur', 'yox'].includes(normalized),
  );
};

export const employeeRowKey = (record: UserData) => {
  const primary = [record.id, record.email, record.qrUid, record.cardUid].find(isUsefulRowKey);

  if (primary) return String(primary).trim().toLowerCase();

  return [record.firstName, record.lastName, record.middleName, record.jobTitle, record.phone1]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');
};

const normalizeSimpleText = (value?: string | number | null) => String(value ?? '').trim().toLowerCase();

export const isSuperAdminRow = (record: Partial<UserData>) => {
  const role = normalizeSimpleText(record.role);
  const email = normalizeSimpleText(record.email);
  const jobTitle = normalizeSimpleText(record.jobTitle);
  const fullName = [record.firstName, record.lastName, record.middleName]
    .map(normalizeSimpleText)
    .filter(Boolean)
    .join(' ');

  return (
    role === 'super-admin' ||
    role === 'superadmin' ||
    role === '2' ||
    email === 'admin@setclapp.com' ||
    (fullName.includes('super') && fullName.includes('admin')) ||
    (jobTitle.includes('system') && jobTitle.includes('admin'))
  );
};

export const employeeDedupKey = (record: UserData) => {
  const email = String(record.email || '').trim().toLowerCase();
  const phone = String(record.phone1 || '').replace(/\D/g, '');
  const name = [record.firstName, record.lastName, record.middleName]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');

  if (email && email.includes('@')) return `email:${email}`;
  if (name && phone) return `name-phone:${name}:${phone}`;
  return employeeRowKey(record);
};

export const userIdentity = (record: UserData) => String(record.id || record.email || employeeRowKey(record));

export const getEmployeeFullName = (record: Partial<UserData>) => {
  return `${record.firstName || ''} ${record.lastName || ''}`.trim() || record.email || 'Əməkdaş';
};

export const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};
