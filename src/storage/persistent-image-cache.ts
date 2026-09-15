const DB_NAME = 'setclapp-persistent-images';
const DB_STORE = 'images';
const DB_VERSION = 1;

const memoryCache = new Map<string, string>();

const canUseIndexedDb = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const normalizeKey = (value: unknown) => String(value ?? '').trim();
const normalizeDataUrl = (value: unknown) => {
  const text = String(value ?? '').trim();
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(text) ? text : '';
};

const openDb = (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE)) {
          database.createObjectStore(DB_STORE);
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

export const readPersistentImage = async (keyValue: unknown): Promise<string> => {
  const key = normalizeKey(keyValue);
  if (!key) return '';

  const memoryValue = normalizeDataUrl(memoryCache.get(key));
  if (memoryValue) return memoryValue;

  const database = await openDb();
  if (!database) return '';

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(key);

      request.onsuccess = () => {
        const value = normalizeDataUrl(request.result);
        if (value) memoryCache.set(key, value);
        resolve(value);
      };
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

export const writePersistentImage = async (
  keyValue: unknown,
  imageValue: unknown,
): Promise<string> => {
  const key = normalizeKey(keyValue);
  const image = normalizeDataUrl(imageValue);
  if (!key || !image) return '';

  memoryCache.set(key, image);
  const database = await openDb();
  if (!database) return image;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(image, key);
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

  return image;
};

export const companyLogoImageKey = (companyId?: string, companyVoen?: string) =>
  `company-logo:${String(companyId || companyVoen || 'current').trim()}`;

export const companyAdminAvatarImageKey = (userId?: string, email?: string) =>
  `company-admin-avatar:${String(userId || email || 'current').trim().toLowerCase()}`;

export const companyAdminBackgroundImageKey = (userId?: string, email?: string) =>
  `company-admin-background:${String(userId || email || 'current').trim().toLowerCase()}`;

export const employeePhotoImageKey = (
  companyId?: string,
  employeeId?: string,
  email?: string,
) => `employee-photo:${String(companyId || 'company').trim()}:${String(employeeId || email || 'employee').trim().toLowerCase()}`;

export const employeeBackgroundImageKey = (
  companyId?: string,
  employeeId?: string,
  email?: string,
) => `employee-background:${String(companyId || 'company').trim()}:${String(employeeId || email || 'employee').trim().toLowerCase()}`;
