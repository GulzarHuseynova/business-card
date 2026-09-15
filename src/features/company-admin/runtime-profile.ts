import type { EditableProfileValues, ProfileSocialAccount } from '../../types/layout.type';
import { runtimeStorage } from '../../storage/runtime.storage';

let profileCache: Partial<EditableProfileValues> = {};
let avatarCache = '';
const COMPANY_ADMIN_AVATAR_KEY = 'companyAdminAvatar';

const cloneSocialAccounts = (items?: ProfileSocialAccount[]) =>
  items?.map((item) => ({ ...item }));

export const readRuntimeCompanyAdminProfile = (): Partial<EditableProfileValues> => ({
  ...profileCache,
  socialAccounts: cloneSocialAccounts(profileCache.socialAccounts),
});

export const mergeRuntimeCompanyAdminProfile = (
  patch: Partial<EditableProfileValues>,
): Partial<EditableProfileValues> => {
  profileCache = {
    ...profileCache,
    ...patch,
    socialAccounts:
      patch.socialAccounts !== undefined
        ? cloneSocialAccounts(patch.socialAccounts)
        : cloneSocialAccounts(profileCache.socialAccounts),
  };

  return readRuntimeCompanyAdminProfile();
};

export const readRuntimeCompanyAdminAvatar = () => avatarCache || runtimeStorage.getItem(COMPANY_ADMIN_AVATAR_KEY) || '';

export const setRuntimeCompanyAdminAvatar = (value?: string) => {
  avatarCache = String(value || '').trim();
  if (avatarCache) runtimeStorage.setItem(COMPANY_ADMIN_AVATAR_KEY, avatarCache);
  else runtimeStorage.removeItem(COMPANY_ADMIN_AVATAR_KEY);
  return avatarCache;
};

export const clearRuntimeCompanyAdminProfile = () => {
  profileCache = {};
  avatarCache = '';
  runtimeStorage.removeItem(COMPANY_ADMIN_AVATAR_KEY);
};
