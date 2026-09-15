export const PERSISTENT_RUNTIME_PREFIXES = [
  'employee-password-changed:',
  'employee-password-required:',
  'employeeAccounts',
  'employeeAccountOverrides',
  'companyUsersCache:',
  'companyInfo:',
  'companyInfoVoen:',
  'companyLogo:',
  'companyLogoVoen:',
  'companyCardBackground:',
  'companyCardBackgroundVoen:',
  'companyAdminAvatar',
  'publicCardProfiles',
  'publicScanLogs',
  'localAuditLogs',
] as const;

export const isPersistentRuntimeKey = (key: string) =>
  PERSISTENT_RUNTIME_PREFIXES.some((prefix) => key.startsWith(prefix));

const RUNTIME_DB_NAME = 'setclapp-persistent-runtime';
const RUNTIME_DB_STORE = 'entries';
const RUNTIME_DB_VERSION = 1;

const persistentOperationQueues = new Map<string, Promise<void>>();

const enqueuePersistentOperation = (key: string, operation: () => Promise<void>) => {
  const previous = persistentOperationQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(operation);

  persistentOperationQueues.set(key, next);
  void next.finally(() => {
    if (persistentOperationQueues.get(key) === next) {
      persistentOperationQueues.delete(key);
    }
  });
};

const canUseIndexedDb = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openRuntimeDb = (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(RUNTIME_DB_NAME, RUNTIME_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RUNTIME_DB_STORE)) {
          database.createObjectStore(RUNTIME_DB_STORE);
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

const writePersistentRuntimeValue = async (key: string, value: string): Promise<void> => {
  if (!isPersistentRuntimeKey(key)) return;

  const database = await openRuntimeDb();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(RUNTIME_DB_STORE, 'readwrite');
      transaction.objectStore(RUNTIME_DB_STORE).put(value, key);
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

const deletePersistentRuntimeValue = async (key: string): Promise<void> => {
  if (!isPersistentRuntimeKey(key)) return;

  const database = await openRuntimeDb();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(RUNTIME_DB_STORE, 'readwrite');
      transaction.objectStore(RUNTIME_DB_STORE).delete(key);
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

const readPersistentRuntimeEntries = async (): Promise<Array<[string, string]>> => {
  const database = await openRuntimeDb();
  if (!database) return [];

  return await new Promise<Array<[string, string]>>((resolve) => {
    const entries: Array<[string, string]> = [];

    try {
      const transaction = database.transaction(RUNTIME_DB_STORE, 'readonly');
      const request = transaction.objectStore(RUNTIME_DB_STORE).openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;

        const key = String(cursor.key ?? '');
        const value = typeof cursor.value === 'string' ? cursor.value : '';
        if (key && value && isPersistentRuntimeKey(key)) entries.push([key, value]);
        cursor.continue();
      };
      request.onerror = () => resolve([]);
      transaction.oncomplete = () => {
        database.close();
        resolve(entries);
      };
      transaction.onerror = () => {
        database.close();
        resolve([]);
      };
      transaction.onabort = () => {
        database.close();
        resolve([]);
      };
    } catch {
      database.close();
      resolve([]);
    }
  });
};

class RuntimeStorage implements Storage {
  private readonly values = new Map<string, string>();

  private get browserStorage(): Storage | null {
    try {
      return typeof window !== 'undefined' ? window.sessionStorage : null;
    } catch {
      return null;
    }
  }

  private get allKeys(): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    const storage = this.browserStorage;

    if (storage) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
      }
    }

    this.values.forEach((_value, key) => {
      if (seen.has(key)) return;
      seen.add(key);
      keys.push(key);
    });

    return keys;
  }

  get length(): number {
    return this.allKeys.length;
  }

  clear(): void {
    try {
      this.browserStorage?.clear();
    } catch {
      // sessionStorage bloklansa belə memory fallback təmizlənir.
    }
    this.values.clear();
  }

  getItem(key: string): string | null {
    const normalizedKey = String(key);

    try {
      const browserValue = this.browserStorage?.getItem(normalizedKey);
      if (browserValue !== null && browserValue !== undefined) return browserValue;
    } catch {
      // memory fallback aşağıda oxunur.
    }

    return this.values.get(normalizedKey) ?? null;
  }

  key(index: number): string | null {
    return this.allKeys[index] ?? null;
  }

  removeItem(key: string): void {
    const normalizedKey = String(key);

    try {
      this.browserStorage?.removeItem(normalizedKey);
    } catch {
      // memory və IndexedDB yenə təmizlənir.
    }

    this.values.delete(normalizedKey);
    if (isPersistentRuntimeKey(normalizedKey)) {
      enqueuePersistentOperation(normalizedKey, () => deletePersistentRuntimeValue(normalizedKey));
    }
  }

  setItem(key: string, value: string): void {
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    let storedInBrowser = false;

    try {
      const storage = this.browserStorage;
      if (storage) {
        storage.setItem(normalizedKey, normalizedValue);
        storedInBrowser = true;
      }
    } catch {
      storedInBrowser = false;
    }

    if (storedInBrowser) this.values.delete(normalizedKey);
    else this.values.set(normalizedKey, normalizedValue);

    if (isPersistentRuntimeKey(normalizedKey)) {
      enqueuePersistentOperation(normalizedKey, () => writePersistentRuntimeValue(normalizedKey, normalizedValue));
    }
  }
}

export const runtimeStorage: Storage = new RuntimeStorage();

export const hydratePersistentRuntimeStorage = async (): Promise<void> => {
  const entries = await readPersistentRuntimeEntries();

  entries.forEach(([key, value]) => {
    if (runtimeStorage.getItem(key) === null) runtimeStorage.setItem(key, value);
  });

  // Köhnə versiyadan localStorage-də qalan tətbiq məlumatlarını IndexedDB-yə
  // bir dəfə köçürürük. Local Storage-də yalnız token və id saxlanılır.
  try {
    const legacyEntries: Array<[string, string]> = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !isPersistentRuntimeKey(key)) continue;

      const value = localStorage.getItem(key);
      if (value !== null) legacyEntries.push([key, value]);
    }

    legacyEntries.forEach(([key, value]) => {
      runtimeStorage.setItem(key, value);
      localStorage.removeItem(key);
    });
  } catch {
    // Brauzer storage-a icazə verməzsə tətbiq session/memory ilə davam edir.
  }
};
