import { runtimeStorage } from '../runtime.storage';
import type { LocalCompanyAdminAccount } from '../../types/local-auth.type';

export type { LocalCompanyAdminAccount } from '../../types/local-auth.type';

const STORAGE_KEY = 'companyAdminAccounts';

const readStorage = (key: string) => runtimeStorage.getItem(key) || localStorage.getItem(key);
const writeStorage = (key: string, value: string) => {
  runtimeStorage.setItem(key, value);
  localStorage.removeItem(key);
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeVoen = (value: string) => value.trim();

const stripLogoFields = (account: LocalCompanyAdminAccount): LocalCompanyAdminAccount => account;

export const readLocalCompanyAdminAccounts = (): LocalCompanyAdminAccount[] => {
  try {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const accounts = parsed
      .filter((item): item is LocalCompanyAdminAccount => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Record<string, unknown>;
        return typeof record.gmail === 'string' && typeof record.password === 'string' && typeof record.voen === 'string';
      })
      .map(stripLogoFields);

    writeStorage(STORAGE_KEY, JSON.stringify(accounts));
    return accounts;
  } catch {
    return [];
  }
};

export const saveLocalCompanyAdminAccount = (account: LocalCompanyAdminAccount) => {
  const accounts = readLocalCompanyAdminAccounts();
  const email = normalizeEmail(account.gmail);
  const voen = normalizeVoen(account.voen);

  const nextAccount: LocalCompanyAdminAccount = stripLogoFields({
    ...account,
    gmail: email,
    voen,
  });

  const companyId = account.companyId?.trim() || '';

  const withoutOld = accounts.filter((item) => {
    const sameEmailAndVoen = normalizeEmail(item.gmail) === email && normalizeVoen(item.voen) === voen;
    const sameCompanyId = Boolean(companyId && item.companyId === companyId);
    const sameVoen = Boolean(voen && normalizeVoen(item.voen) === voen);

    return !sameEmailAndVoen && !sameCompanyId && !sameVoen;
  });

  writeStorage(STORAGE_KEY, JSON.stringify([...withoutOld, nextAccount]));
};

export const removeLocalCompanyAdminAccount = (companyId: string, voen: string) => {
  const cleanCompanyId = companyId.trim();
  const cleanVoen = normalizeVoen(voen);
  const accounts = readLocalCompanyAdminAccounts();

  const nextAccounts = accounts.filter((account) => {
    const sameCompanyId = Boolean(cleanCompanyId && account.companyId === cleanCompanyId);
    const sameVoen = Boolean(cleanVoen && normalizeVoen(account.voen) === cleanVoen);
    return !sameCompanyId && !sameVoen;
  });

  writeStorage(STORAGE_KEY, JSON.stringify(nextAccounts));
};


export const updateLocalCompanyAdminCompany = (
  companyId: string,
  voen: string,
  updates: Partial<Pick<LocalCompanyAdminAccount, 'companyName' | 'logo' | 'logoUrl' | 'address' | 'contact' | 'employeeLimit'>>
) => {
  const accounts = readLocalCompanyAdminAccounts();
  const cleanCompanyId = companyId.trim();
  const cleanVoen = normalizeVoen(voen);

  let changed = false;
  const nextAccounts = accounts.map((account) => {
    const sameCompanyId = cleanCompanyId && account.companyId === cleanCompanyId;
    const sameVoen = cleanVoen && normalizeVoen(account.voen) === cleanVoen;

    if (!sameCompanyId && !sameVoen) return account;

    changed = true;
    return {
      ...account,
      ...stripLogoFields(updates as LocalCompanyAdminAccount),
    };
  });

  if (changed) {
    writeStorage(STORAGE_KEY, JSON.stringify(nextAccounts));
  }

  return changed;
};


export const updateLocalCompanyAdminPassword = (
  gmail: string,
  voen: string,
  newPassword: string
) => {
  const accounts = readLocalCompanyAdminAccounts();
  const email = normalizeEmail(gmail);
  const cleanVoen = normalizeVoen(voen);
  const cleanPassword = newPassword.trim();

  if (!email || !cleanVoen || !cleanPassword) return false;

  let changed = false;
  const nextAccounts = accounts.map((account) => {
    const sameAccount = normalizeEmail(account.gmail) === email && normalizeVoen(account.voen) === cleanVoen;
    if (!sameAccount) return account;

    changed = true;
    return {
      ...account,
      password: cleanPassword,
      mustChangePassword: false,
      firstLogin: false,
      isFirstLogin: false,
    };
  });

  if (changed) {
    writeStorage(STORAGE_KEY, JSON.stringify(nextAccounts));
  }

  return changed;
};

export const findLocalCompanyAdminAccount = (
  gmail: string,
  password: string,
  voen: string
): LocalCompanyAdminAccount | null => {
  const email = normalizeEmail(gmail);
  const cleanPassword = password.trim();
  const cleanVoen = normalizeVoen(voen);

  if (!email || !cleanPassword || !cleanVoen) return null;

  return (
    readLocalCompanyAdminAccounts().find((account) => {
      return (
        normalizeEmail(account.gmail) === email &&
        account.password === cleanPassword &&
        normalizeVoen(account.voen) === cleanVoen
      );
    }) || null
  );
};
