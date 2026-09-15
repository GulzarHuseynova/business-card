import { normalizeAssetUrl } from '../../utils/asset-url.utils';
import { runtimeStorage } from '../../storage/runtime.storage';

export const COMPANY_CARD_BACKGROUND_PREFIX = 'companyCardBackground:';
export const COMPANY_CARD_BACKGROUND_VOEN_PREFIX = 'companyCardBackgroundVoen:';

const BACKGROUND_DB_NAME = 'setclapp-company-card-theme';
const BACKGROUND_DB_STORE = 'backgrounds';
const BACKGROUND_DB_VERSION = 1;

const backgroundKeys = (companyId?: string, companyVoen?: string) => [
  companyId ? `${COMPANY_CARD_BACKGROUND_PREFIX}${companyId.trim()}` : '',
  companyVoen ? `${COMPANY_CARD_BACKGROUND_VOEN_PREFIX}${companyVoen.trim()}` : '',
].filter(Boolean);

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openBackgroundDb = (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(BACKGROUND_DB_NAME, BACKGROUND_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BACKGROUND_DB_STORE)) {
          database.createObjectStore(BACKGROUND_DB_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const readPersistentBackground = async (key: string): Promise<string> => {
  const database = await openBackgroundDb();
  if (!database) return '';

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(BACKGROUND_DB_STORE, 'readonly');
      const request = transaction.objectStore(BACKGROUND_DB_STORE).get(key);

      request.onsuccess = () => resolve(normalizeAssetUrl(request.result));
      request.onerror = () => resolve('');
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
      transaction.onabort = () => database.close();
    } catch {
      database.close();
      resolve('');
    }
  });
};

const writePersistentBackground = async (key: string, value: string): Promise<void> => {
  const database = await openBackgroundDb();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(BACKGROUND_DB_STORE, 'readwrite');
      transaction.objectStore(BACKGROUND_DB_STORE).put(value, key);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        resolve();
      };
    } catch {
      database.close();
      resolve();
    }
  });
};

const readRuntimeValue = (key: string) => {
  const runtimeValue = runtimeStorage.getItem(key);
  if (runtimeValue !== null) {
    const normalized = normalizeAssetUrl(runtimeValue);
    if (normalized) void writePersistentBackground(key, normalized);
    return runtimeValue;
  }

  // Köhnə versiyada bu məlumat localStorage-də qalıbsa runtime və IndexedDB-yə köçürürük.
  const legacyValue = localStorage.getItem(key);
  if (legacyValue !== null) {
    const normalized = normalizeAssetUrl(legacyValue);
    if (normalized) {
      runtimeStorage.setItem(key, normalized);
      void writePersistentBackground(key, normalized);
    }
    localStorage.removeItem(key);
  }

  return legacyValue;
};

export const getSavedCompanyCardBackground = (companyId?: string, companyVoen?: string) => {
  for (const key of backgroundKeys(companyId, companyVoen)) {
    const background = normalizeAssetUrl(readRuntimeValue(key));
    if (background) return background;
  }

  return '';
};

export const getSavedCompanyCardBackgroundAsync = async (
  companyId?: string,
  companyVoen?: string,
) => {
  const runtimeBackground = getSavedCompanyCardBackground(companyId, companyVoen);
  if (runtimeBackground) return runtimeBackground;

  for (const key of backgroundKeys(companyId, companyVoen)) {
    const background = await readPersistentBackground(key);
    if (!background) continue;

    runtimeStorage.setItem(key, background);
    localStorage.removeItem(key);
    return background;
  }

  return '';
};

export const saveCompanyCardBackground = (
  value: unknown,
  companyId?: string,
  companyVoen?: string,
) => {
  const background = normalizeAssetUrl(value);
  if (!background) return '';

  backgroundKeys(companyId, companyVoen).forEach((key) => {
    runtimeStorage.setItem(key, background);
    localStorage.removeItem(key);
    void writePersistentBackground(key, background);
  });

  return background;
};
