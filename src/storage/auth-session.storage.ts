import { clearStoredAuthSession } from './auth.storage';

export const authSessionStorage = {
  clear: () => {
    clearStoredAuthSession();
  },

  clearAndRedirect: (fallbackUrl = '/login') => {
    authSessionStorage.clear();
    window.location.href = fallbackUrl;
  },
};
