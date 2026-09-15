import type { AnyRecord, NormalizedRole } from '../types/common.type';

export type { AnyRecord, NormalizedRole } from '../types/common.type';

const ARRAY_KEYS = [
  'data', 'items', 'users', 'employees', 'companies', 'logs', 'ranking', 'chart',
  'result', 'results', 'value', 'values', '$values', 'records', 'list', 'rows',
];

const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_.-]/g, '');

export const isRecord = (value: unknown): value is AnyRecord => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

export const asString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'active', 'aktiv'].includes(normalized)) return true;
    if (['false', '0', 'no', 'inactive', 'deaktiv'].includes(normalized)) return false;
  }
  return fallback;
};

export const unwrapData = (data: unknown): unknown => {
  let current = data;
  const keys = ['data', 'result', 'value', 'response'];

  for (let index = 0; index < 4; index += 1) {
    if (!isRecord(current)) return current;
    const record = current;
    const foundKey = keys.find((key) => record[key] !== undefined);
    if (!foundKey) return current;
    current = record[foundKey];
  }

  return current;
};

export const normalizeArray = <T = unknown>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];

  const root = unwrapData(data);
  if (Array.isArray(root)) return root as T[];

  if (!isRecord(root)) return [];

  for (const key of ARRAY_KEYS) {
    const value = root[key];
    if (Array.isArray(value)) return value as T[];
    if (isRecord(value) && Array.isArray(value.$values)) return value.$values as T[];
  }

  const queue: unknown[] = [root];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) return current as T[];

    if (isRecord(current)) {
      for (const value of Object.values(current)) {
        if (Array.isArray(value)) return value as T[];
        if (isRecord(value) || Array.isArray(value)) queue.push(value);
      }
    }
  }

  return [];
};

export const findDeep = (data: unknown, wantedKeys: string[]): unknown => {
  if (!data) return undefined;

  const wanted = wantedKeys.map(normalizeKey);
  const queue: unknown[] = [data];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (isRecord(current)) {
      for (const [key, value] of Object.entries(current)) {
        const normalized = normalizeKey(key);
        const isWanted = wanted.some((wantedKey) => normalized === wantedKey || normalized.endsWith(wantedKey));
        if (isWanted && value !== undefined && value !== null && value !== '') return value;
        if (isRecord(value) || Array.isArray(value)) queue.push(value);
      }
    } else if (Array.isArray(current)) {
      queue.push(...current);
    }
  }

  return undefined;
};

export const findStringDeep = (data: unknown, wantedKeys: string[]): string => asString(findDeep(data, wantedKeys));

export const findNumberDeep = (data: unknown, wantedKeys: string[], fallback = 0): number => {
  return asNumber(findDeep(data, wantedKeys), fallback);
};

export const findObjectDeep = (data: unknown, wantedKeys: string[]): AnyRecord | null => {
  const direct = findDeep(data, wantedKeys);
  if (isRecord(direct)) return direct;
  return null;
};

export const parseJwt = (token: string): AnyRecord => {
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return {};
    const decoded = atob(base64);
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json) as AnyRecord;
  } catch {
    return {};
  }
};

export const normalizeRole = (role: unknown): NormalizedRole => {
  if (typeof role === 'number') {
    if (role === 0) return 'employee';
    if (role === 1) return 'company-admin';
    if (role === 2) return 'super-admin';
  }

  const value = asString(role).toLowerCase().replace(/[\s_]/g, '');
  if (['2', 'superadmin', 'super-admin', 'superadministrator', 'super'].includes(value)) return 'super-admin';
  if (['1', 'companyadmin', 'company-admin', 'companyadministrator', 'company'].includes(value)) return 'company-admin';
  if (['0', 'employee', 'employe', 'user', 'worker', 'staff'].includes(value)) return 'employee';
  return '';
};

export const extractRole = (...sources: unknown[]): NormalizedRole => {
  for (const source of sources) {
    const role = normalizeRole(
      findStringDeep(source, [
        'role',
        'roles',
        'userRole',
        'roleName',
        'accountRole',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      ])
    );
    if (role) return role;
  }
  return '';
};

export const extractAccessToken = (data: unknown): string => {
  return findStringDeep(data, ['accessToken', 'access_token', 'token', 'jwt', 'bearerToken']);
};

export const extractRefreshToken = (data: unknown): string => {
  return findStringDeep(data, ['refreshToken', 'refresh_token', 'refresh']);
};

export const extractCompanyId = (...sources: unknown[]): string => {
  for (const source of sources) {
    const companyObject = findObjectDeep(source, ['company']);
    const direct = findStringDeep(source, ['companyId', 'companyID', 'company_id']);
    const nested = companyObject ? findStringDeep(companyObject, ['id', 'companyId']) : '';
    const id = direct || nested;
    if (id) return id;
  }
  return '';
};

export const extractCompanyVoen = (...sources: unknown[]): string => {
  for (const source of sources) {
    const voen = findStringDeep(source, ['voen', 'companyVoen', 'taxId', 'taxNumber']);
    if (voen) return voen;
  }
  return '';
};

const getDirectString = (source: unknown, keys: string[]): string => {
  if (!isRecord(source)) return '';

  for (const key of keys) {
    const direct = asString(source[key]);
    if (direct) return direct;
  }

  return '';
};

const looksLikeCompanyIdValue = (source: unknown, id: string): boolean => {
  if (!id || !isRecord(source)) return false;

  const directCompanyId = getDirectString(source, ['companyId', 'companyID', 'company_id']);
  const companyObject = findObjectDeep(source, ['company']);
  const nestedCompanyId = companyObject ? getDirectString(companyObject, ['id', 'companyId', 'companyID', 'company_id']) : '';

  return Boolean((directCompanyId && directCompanyId === id) || (nestedCompanyId && nestedCompanyId === id));
};

export const extractUserId = (...sources: unknown[]): string => {
  for (const source of sources) {
    const direct = getDirectString(source, ['userId', 'employeeId', 'cardId', 'profileId']);
    if (direct && !looksLikeCompanyIdValue(source, direct)) return direct;
  }

  for (const source of sources) {
    const claim = getDirectString(source, [
      'sub',
      'nameidentifier',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ]);
    if (claim && !looksLikeCompanyIdValue(source, claim)) return claim;
  }

  for (const source of sources) {
    const directId = getDirectString(source, ['id']);
    if (directId && !looksLikeCompanyIdValue(source, directId)) return directId;
  }

  return '';
};

export const getStoredToken = () => localStorage.getItem('token') || localStorage.getItem('accessToken') || '';

export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  if (!token || token.startsWith('local-')) return {};
  return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
};
