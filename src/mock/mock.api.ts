import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { createDefaultMockDatabase, type MockAccount, type MockDatabase, type MockUser } from './mock.data';

const DB_KEY = 'setclapp:mock-api-db:v1';
const NETWORK_DELAY_MS = 80;

const clone = <T,>(value: T): T => structuredClone(value);

const loadDb = (): MockDatabase => {
  try {
    const raw = sessionStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as MockDatabase;
  } catch {
    // sessionStorage bloklanarsa default data istifadə olunur.
  }
  const db = createDefaultMockDatabase();
  saveDb(db);
  return db;
};

const saveDb = (db: MockDatabase) => {
  try {
    sessionStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Mock rejim storage olmadan da işləyə bilər.
  }
};

const wait = () => new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));
const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();
const decode = (value: string) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

const parseBody = (data: unknown): Record<string, unknown> => {
  if (!data) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data) as Record<string, unknown>; } catch { return {}; }
  }
  if (typeof data === 'object' && !(data instanceof FormData)) return data as Record<string, unknown>;
  return {};
};

const base64Url = (value: string) => btoa(unescape(encodeURIComponent(value)))
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const makeToken = (account: MockAccount) => {
  const payload = {
    sub: account.userId,
    userId: account.userId,
    role: account.role,
    companyId: account.companyId || '',
    companyVoen: account.companyVoen || '',
    voen: account.companyVoen || '',
    email: account.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
  return `${base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64Url(JSON.stringify(payload))}.mock`;
};

const parseToken = (token: string): Record<string, unknown> => {
  try {
    const part = token.replace(/^Bearer\s+/i, '').split('.')[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded)))) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const getCurrentAccount = (db: MockDatabase, config: AxiosRequestConfig): MockAccount | undefined => {
  const headers = config.headers as Record<string, unknown> | undefined;
  const authorization = text(headers?.Authorization || headers?.authorization);
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const payload = parseToken(authorization || storedToken);
  const userId = text(payload.userId || payload.sub);
  const email = lower(payload.email);
  return db.accounts.find((item) => item.userId === userId || lower(item.email) === email);
};

const getAccountInfo = (db: MockDatabase, account?: MockAccount) => {
  if (!account) return null;
  if (account.role === 'super-admin') {
    return {
      id: account.userId,
      userId: account.userId,
      firstName: 'Super',
      lastName: 'Admin',
      fullName: 'Super Admin',
      email: account.email,
      gmail: account.email,
      role: 'super-admin',
      mustChangePassword: false,
      firstLogin: false,
      isFirstLogin: false,
    };
  }
  const user = db.users.find((item) => item.id === account.userId || lower(item.email) === lower(account.email));
  return user ? clone(user) : {
    id: account.userId,
    userId: account.userId,
    email: account.email,
    gmail: account.email,
    role: account.role,
    companyId: account.companyId,
    companyVoen: account.companyVoen,
    voen: account.companyVoen,
    mustChangePassword: false,
    firstLogin: false,
    isFirstLogin: false,
  };
};

const response = <T,>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
  headers: new AxiosHeaders({ 'x-setclapp-mock': 'true' }),
  config,
});

function fail(config: InternalAxiosRequestConfig, status: number, message: string): never {
  const res = response(config, { message }, status);
  throw new AxiosError(message, status === 401 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE', config, undefined, res);
}

function requireValue<T>(value: T | null | undefined, config: InternalAxiosRequestConfig, status: number, message: string): T {
  if (value === null || value === undefined) fail(config, status, message);
  return value;
}

const fileToDataUrl = async (file: File | Blob | null): Promise<string> => {
  if (!file) return '';
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
};

const formFile = (data: unknown) => data instanceof FormData ? data.get('file') : null;

const addAudit = (db: MockDatabase, details: string, account?: MockAccount, companyId?: string) => {
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    userId: account?.userId || 'mock-user',
    userName: account?.email || 'Mock User',
    actionType: 'Update',
    entity: 'MockData',
    beforeValue: '',
    afterValue: '',
    details,
    companyId: companyId || account?.companyId || '',
    companyVoen: account?.companyVoen || '',
  });
};

const vcardFor = (user: MockUser) => `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${user.fullName}\r\nORG:${user.companyName}\r\nTITLE:${user.jobTitle}\r\nTEL:${user.phone1}\r\nEMAIL:${user.email}\r\nEND:VCARD\r\n`;

const companyUsers = (db: MockDatabase, companyId: string) => db.users.filter((user) => user.companyId === companyId && user.role !== 'company-admin');

const analyticsForCompany = (db: MockDatabase, companyId: string) => {
  const users = companyUsers(db, companyId);
  const logs = db.scanLogs.filter((item) => text(item.companyId) === companyId);
  const ranking = users.map((user) => ({
    id: user.id,
    key: user.id,
    employeeId: user.id,
    employeeName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    scans: user.scanCount,
    scanCount: user.scanCount,
    count: user.scanCount,
    status: user.isActive ? 'active' : 'inactive',
  })).sort((a, b) => b.scanCount - a.scanCount);
  const current = new Date();
  const chart = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
    const count = Math.max(4, Math.round((ranking.reduce((sum, row) => sum + row.scanCount, 0) / 18) * (index + 1)));
    return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, count, scans: count, value: count };
  });
  return { users, logs, ranking, chart, count: ranking.reduce((sum, row) => sum + row.scanCount, 0) };
};

export const resetMockDatabase = () => {
  saveDb(createDefaultMockDatabase());
};

export const mockApiAdapter: AxiosAdapter = async (config): Promise<AxiosResponse> => {
  await wait();
  const request = config as InternalAxiosRequestConfig;
  const db = loadDb();
  const method = (config.method || 'get').toLowerCase();
  const rawUrl = text(config.url).replace(/^https?:\/\/[^/]+/i, '');
  const url = rawUrl.split('?')[0].replace(/\/+$/, '') || '/';
  const body = parseBody(config.data);
  const params = (config.params || {}) as Record<string, unknown>;
  const account = getCurrentAccount(db, config);

  if (method === 'post' && url === '/api/Auth/login') {
    const email = lower(body.email);
    const password = text(body.password);
    const voen = text(body.companyVoen);
    const found = requireValue(db.accounts.find((item) =>
      lower(item.email) === email &&
      item.password === password &&
      (item.role === 'super-admin' ? !voen : item.companyVoen === voen)
    ), request, 401, 'E-poçt, kod və ya VÖEN yanlışdır.');
    const info = getAccountInfo(db, found);
    return response(request, {
      accessToken: makeToken(found),
      refreshToken: `mock-refresh-${found.userId}`,
      role: found.role,
      companyId: found.companyId || '',
      companyVoen: found.companyVoen || '',
      userId: found.userId,
      accountInfo: info,
      mustChangePassword: false,
      firstLogin: false,
      isFirstLogin: false,
    });
  }

  if (method === 'get' && url === '/api/Auth/account-info') {
    const currentAccount = requireValue(account, request, 401, 'Mock session tapılmadı.');
    return response(request, getAccountInfo(db, currentAccount));
  }

  if (method === 'post' && url === '/api/Auth/change-password') {
    const currentAccount = requireValue(account, request, 401, 'Mock session tapılmadı.');
    const newPassword = text(body.newPassword);
    if (!newPassword) fail(request, 400, 'Yeni şifrə boş ola bilməz.');
    currentAccount.password = newPassword;
    const user = db.users.find((item) => item.id === currentAccount.userId);
    if (user) user.password = newPassword;
    saveDb(db);
    return response(request, { success: true, message: 'Şifrə mock data-da yeniləndi.' });
  }

  if (method === 'get' && url === '/api/SuperAdmin/companies') return response(request, clone(db.companies));

  if (method === 'post' && url === '/api/SuperAdmin/companies') {
    const id = text(body.id || body.companyId) || `company-${crypto.randomUUID()}`;
    const name = text(body.name || body.companyName) || 'Yeni şirkət';
    const voen = text(body.voen);
    const limit = Number(body.userLimit || body.employeeLimit || body.limit || 10);
    const company = {
      id, companyId: id, name, companyName: name, voen,
      industry: text(body.industry) || 'Digər', address: text(body.address), contact: text(body.contact),
      email: text(body.email || body.gmail), phone: text(body.phone), employeeLimit: limit, userLimit: limit, limit, UserLimit: limit,
      isActive: true, status: 'Aktiv', scanCount: 0, logo: text(body.logo || body.logoUrl), logoUrl: text(body.logoUrl || body.logo), nfcBaseUrl: '/card/',
    };
    db.companies.push(company);
    addAudit(db, `${name} şirkəti yaradıldı.`, account, id);
    saveDb(db);
    return response(request, clone(company), 201);
  }

  const companyMatch = url.match(/^\/api\/SuperAdmin\/companies\/([^/]+)$/);
  if (companyMatch && method === 'put') {
    const id = decode(companyMatch[1]);
    const company = requireValue(db.companies.find((item) => item.id === id || item.companyId === id), request, 404, 'Şirkət tapılmadı.');
    const limit = body.userLimit ?? body.employeeLimit ?? body.limit;
    Object.assign(company, body, {
      name: text(body.name || body.companyName || company.name),
      companyName: text(body.name || body.companyName || company.companyName),
      ...(limit !== undefined ? { employeeLimit: Number(limit), userLimit: Number(limit), limit: Number(limit), UserLimit: Number(limit) } : {}),
    });
    addAudit(db, `${company.companyName} şirkəti yeniləndi.`, account, company.id);
    saveDb(db);
    return response(request, clone(company));
  }

  const companyActiveMatch = url.match(/^\/api\/SuperAdmin\/companies\/([^/]+)\/active$/);
  if (companyActiveMatch && method === 'put') {
    const company = requireValue(db.companies.find((item) => item.id === decode(companyActiveMatch[1])), request, 404, 'Şirkət tapılmadı.');
    const isActive = String(params.isActive) === 'true' || params.isActive === true;
    company.isActive = isActive;
    company.status = isActive ? 'Aktiv' : 'Deaktiv';
    saveDb(db);
    return response(request, clone(company));
  }

  const companyLimitMatch = url.match(/^\/api\/SuperAdmin\/companies\/([^/]+)\/limit$/);
  if (companyLimitMatch && method === 'put') {
    const company = requireValue(db.companies.find((item) => item.id === decode(companyLimitMatch[1])), request, 404, 'Şirkət tapılmadı.');
    const limit = Number(typeof config.data === 'string' ? JSON.parse(config.data) : config.data);
    company.employeeLimit = limit; company.userLimit = limit; company.limit = limit; company.UserLimit = limit;
    saveDb(db);
    return response(request, { success: true, limit });
  }

  if (method === 'get' && url === '/api/CompanyAdmin/company') {
    const company = db.companies.find((item) => item.id === account?.companyId || item.voen === account?.companyVoen) || db.companies[0];
    return response(request, clone(company));
  }

  if (method === 'put' && url === '/api/CompanyAdmin/company') {
    const company = db.companies.find((item) => item.id === account?.companyId || item.voen === account?.companyVoen) || db.companies[0];
    Object.assign(company, body);
    company.name = text(body.name || body.companyName || company.name);
    company.companyName = company.name;
    saveDb(db);
    return response(request, clone(company));
  }

  if (method === 'post' && url === '/api/CompanyAdmin/company/logo') {
    const file = formFile(config.data);
    const logoUrl = await fileToDataUrl(file instanceof Blob ? file : null);
    const company = db.companies.find((item) => item.id === account?.companyId) || db.companies[0];
    if (logoUrl) { company.logo = logoUrl; company.logoUrl = logoUrl; saveDb(db); }
    return response(request, { logoUrl, url: logoUrl, fileUrl: logoUrl });
  }

  const usersCompanyMatch = url.match(/^\/api\/CompanyAdmin\/users\/company\/([^/]+)$/);
  if (usersCompanyMatch && method === 'get') {
    return response(request, clone(companyUsers(db, decode(usersCompanyMatch[1]))));
  }

  if (url === '/api/CompanyAdmin/users' && method === 'post') {
    const companyId = text(body.companyId || account?.companyId || db.companies[0]?.id);
    const company = db.companies.find((item) => item.id === companyId) || db.companies[0];
    const email = lower(body.email || body.gmail);
    const roleValue = body.role;
    const role = roleValue === 1 || String(roleValue).toLowerCase().includes('admin') ? 'company-admin' : 'employee';
    const id = text(body.id || body.userId) || `${role}-${crypto.randomUUID()}`;
    const user: MockUser = {
      id, userId: id, employeeId: id, companyId: company.id, companyName: company.companyName, companyVoen: company.voen, voen: company.voen,
      firstName: text(body.firstName || body.adminName || 'Yeni'), lastName: text(body.lastName || 'İstifadəçi'), middleName: text(body.middleName),
      fullName: text(body.fullName || body.adminName) || `${text(body.firstName || 'Yeni')} ${text(body.lastName || 'İstifadəçi')}`.trim(),
      jobTitle: text(body.jobTitle) || (role === 'company-admin' ? 'Company Admin' : 'Əməkdaş'),
      email, gmail: email, password: text(body.password || body.code) || '123456', role,
      phone1: text(body.phone1 || body.phone) || '-', phone2: text(body.phone2), whatsapp: text(body.whatsapp), extensionNumber: text(body.extensionNumber),
      linkedin: text(body.linkedin), facebook: text(body.facebook), instagram: text(body.instagram), address: text(body.address), additionalInfo: text(body.additionalInfo), googleMapsUrl: text(body.googleMapsUrl),
      photo: text(body.photo || body.photoUrl), photoUrl: text(body.photoUrl || body.photo), photoData: text(body.photoData), cardBackgroundUrl: text(body.cardBackgroundUrl),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive), canEdit: body.canEdit === undefined ? true : Boolean(body.canEdit),
      scans: 0, scanCount: 0, qrUid: crypto.randomUUID(), mustChangePassword: false, firstLogin: false, isFirstLogin: false,
    };
    db.users.push(user);
    db.accounts.push({ email, password: user.password, role, companyId: company.id, companyVoen: company.voen, userId: id });
    addAudit(db, `${user.fullName} istifadəçisi yaradıldı.`, account, company.id);
    saveDb(db);
    return response(request, clone(user), 201);
  }

  const userPhotoMatch = url.match(/^\/api\/CompanyAdmin\/users\/([^/]+)\/photo$/);
  if (userPhotoMatch && method === 'post') {
    const user = requireValue(db.users.find((item) => item.id === decode(userPhotoMatch[1])), request, 404, 'İstifadəçi tapılmadı.');
    const file = formFile(config.data);
    const photoUrl = await fileToDataUrl(file instanceof Blob ? file : null);
    if (photoUrl) { user.photo = photoUrl; user.photoUrl = photoUrl; user.photoData = photoUrl; saveDb(db); }
    return response(request, { photoUrl, url: photoUrl, fileUrl: photoUrl });
  }

  const userCanEditMatch = url.match(/^\/api\/CompanyAdmin\/users\/([^/]+)\/canedit$/);
  if (userCanEditMatch && method === 'put') {
    const user = requireValue(db.users.find((item) => item.id === decode(userCanEditMatch[1])), request, 404, 'İstifadəçi tapılmadı.');
    user.canEdit = String(params.canEdit) === 'true' || params.canEdit === true;
    saveDb(db); return response(request, clone(user));
  }

  const userActiveMatch = url.match(/^\/api\/CompanyAdmin\/users\/([^/]+)\/active$/);
  if (userActiveMatch && method === 'put') {
    const user = requireValue(db.users.find((item) => item.id === decode(userActiveMatch[1])), request, 404, 'İstifadəçi tapılmadı.');
    user.isActive = String(params.isActive) === 'true' || params.isActive === true;
    saveDb(db); return response(request, clone(user));
  }

  const resetPasswordMatch = url.match(/^\/api\/CompanyAdmin\/users\/([^/]+)\/reset-password$/);
  if (resetPasswordMatch && method === 'post') {
    const userId = decode(resetPasswordMatch[1]);
    const user = requireValue(db.users.find((item) => item.id === userId), request, 404, 'İstifadəçi tapılmadı.');
    const userAccount = requireValue(db.accounts.find((item) => item.userId === userId), request, 404, 'İstifadəçi hesabı tapılmadı.');
    const newPassword = text(body.newPassword) || '123456';
    user.password = newPassword; userAccount.password = newPassword; saveDb(db);
    return response(request, { success: true });
  }

  const userUpdateMatch = url.match(/^\/api\/CompanyAdmin\/users\/([^/]+)$/);
  if (userUpdateMatch && method === 'put') {
    const user = requireValue(db.users.find((item) => item.id === decode(userUpdateMatch[1])), request, 404, 'İstifadəçi tapılmadı.');
    Object.assign(user, body);
    user.fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    saveDb(db); return response(request, clone(user));
  }

  const getUserMatch = url.match(/^\/api\/User\/([^/]+)$/);
  if (getUserMatch && method === 'get') {
    const id = decode(getUserMatch[1]);
    const user = requireValue(db.users.find((item) => item.id === id || item.qrUid === id || lower(item.email) === lower(id)), request, 404, 'İstifadəçi tapılmadı.');
    return response(request, clone(user));
  }

  if (url === '/api/User/profile' && method === 'put') {
    const user = requireValue(db.users.find((item) => item.id === account?.userId), request, 404, 'Profil tapılmadı.');
    Object.assign(user, body);
    user.fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    saveDb(db); return response(request, clone(user));
  }

  if (['/api/User/profile/photo', '/api/User/profile/card-background', '/api/User/profile/social-icon'].includes(url) && method === 'post') {
    const file = formFile(config.data);
    const dataUrl = await fileToDataUrl(file instanceof Blob ? file : null);
    const user = db.users.find((item) => item.id === account?.userId);
    if (user && dataUrl) {
      if (url.endsWith('/photo')) { user.photo = dataUrl; user.photoUrl = dataUrl; user.photoData = dataUrl; }
      if (url.endsWith('/card-background')) user.cardBackgroundUrl = dataUrl;
      saveDb(db);
    }
    return response(request, url.endsWith('/photo') ? { photoUrl: dataUrl, url: dataUrl } : url.endsWith('/card-background') ? { cardBackgroundUrl: dataUrl, url: dataUrl } : { iconUrl: dataUrl, url: dataUrl });
  }

  const publicCardMatch = url.match(/^\/api\/cards\/([^/]+)$/);
  if (publicCardMatch && method === 'get') {
    const id = decode(publicCardMatch[1]);
    const user = requireValue(db.users.find((item) => item.id === id || item.qrUid === id || lower(item.email) === lower(id)), request, 404, 'Kart tapılmadı.');
    const company = db.companies.find((item) => item.id === user.companyId);
    return response(request, { ...clone(user), company: clone(company), companyInfo: clone(company) });
  }

  if (url === '/api/Analytics/scans/count' && method === 'get') {
    const companyId = text(params.companyId || account?.companyId || db.companies[0]?.id);
    const analytics = analyticsForCompany(db, companyId);
    return response(request, { count: analytics.count, total: analytics.count, totalScans: analytics.count });
  }
  if (url === '/api/Analytics/scans/chart' && method === 'get') {
    const companyId = text(params.companyId || account?.companyId || db.companies[0]?.id);
    return response(request, analyticsForCompany(db, companyId).chart);
  }
  if (url === '/api/Analytics/employees/ranking' && method === 'get') {
    const companyId = text(params.companyId || account?.companyId || db.companies[0]?.id);
    return response(request, analyticsForCompany(db, companyId).ranking);
  }
  if (url === '/api/Analytics/scans/logs' && method === 'get') {
    const companyId = text(params.companyId || account?.companyId || db.companies[0]?.id);
    return response(request, analyticsForCompany(db, companyId).logs);
  }

  if (url === '/api/AuditLog' && method === 'get') {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.max(1, Number(params.pageSize || 10));
    const start = (page - 1) * pageSize;
    const rows = db.auditLogs.slice(start, start + pageSize);
    return response(request, { data: clone(rows), items: clone(rows), rows: clone(rows), total: db.auditLogs.length, totalCount: db.auditLogs.length });
  }

  const vcfMatch = url.match(/^\/api\/ExportImport\/vcf\/([^/]+)$/);
  if (vcfMatch && method === 'get') {
    const user = requireValue(db.users.find((item) => item.id === decode(vcfMatch[1])), request, 404, 'İstifadəçi tapılmadı.');
    return response(request, new Blob([vcardFor(user)], { type: 'text/vcard;charset=utf-8' }));
  }

  const qrMatch = url.match(/^\/api\/ExportImport\/qr\/([^/]+)$/);
  if (qrMatch && method === 'get') {
    const user = db.users.find((item) => item.id === decode(qrMatch[1]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="white"/><rect x="48" y="48" width="416" height="416" rx="36" fill="#111827"/><text x="256" y="250" text-anchor="middle" fill="white" font-family="Arial" font-size="34">SETCLAPP QR</text><text x="256" y="300" text-anchor="middle" fill="white" font-family="Arial" font-size="18">${user?.qrUid || 'MOCK'}</text></svg>`;
    return response(request, new Blob([svg], { type: 'image/svg+xml' }));
  }

  const htmlUserMatch = url.match(/^\/api\/ExportImport\/html\/user\/([^/]+)$/);
  if (htmlUserMatch && method === 'get') {
    const user = db.users.find((item) => item.id === decode(htmlUserMatch[1]));
    return response(request, new Blob([`<!doctype html><html><body><h1>${user?.fullName || 'SetClapp User'}</h1><p>${user?.jobTitle || ''}</p></body></html>`], { type: 'text/html;charset=utf-8' }));
  }

  const htmlCompanyMatch = url.match(/^\/api\/ExportImport\/html\/([^/]+)$/);
  if (htmlCompanyMatch && method === 'get') {
    const company = db.companies.find((item) => item.id === decode(htmlCompanyMatch[1]));
    return response(request, new Blob([`<!doctype html><html><body><h1>${company?.companyName || 'SetClapp Company'}</h1></body></html>`], { type: 'text/html;charset=utf-8' }));
  }

  if (url.startsWith('/api/ExportImport/excel') && (method === 'get' || method === 'post')) {
    const csv = ['Ad,Soyad,Email,Vəzifə', ...db.users.map((user) => `${user.firstName},${user.lastName},${user.email},${user.jobTitle}`)].join('\n');
    return response(request, new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  }

  return fail(request, 404, `Mock endpoint tapılmadı: ${method.toUpperCase()} ${url}`);
};
