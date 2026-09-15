import type { ReactNode } from 'react';

export interface ProfileSocialAccount {
  platformName?: string;
  profileUrl?: string;
  iconUrl?: string;
}

export interface EditableProfileValues {
  firstName: string;
  lastName: string;
  middleName?: string;
  jobTitle?: string;
  phone1?: string;
  phone2?: string;
  whatsappPhone?: string;
  extensionNumber?: string;
  additionalInfo?: string;
  photoUrl?: string;
  googleMapsUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  cardBackgroundUrl?: string;
  socialAccounts?: ProfileSocialAccount[];
}

export type AppRole = 'super-admin' | 'company-admin' | 'employee';

export interface LayoutMenuItem {
  key: string;
  label: string;
  path: string;
  icon: ReactNode;
}

export interface RoleConfig {
  brand: string;
  brandSub: string;
  logo: string;
  userTitle: string;
  userStatus: string;
  userTag: string;
  tagColor: string;
  menu: LayoutMenuItem[];
}

export interface AppLayoutProps {
  role: AppRole;
  children: ReactNode;
  onLogout: () => void;
  titleSuffix?: string;
  userName?: string;
  avatarText?: string;
  avatarSrc?: string;
  notificationCount?: number;
  profileDetails?: { label: string; value?: string }[];
  profileInitialValues?: EditableProfileValues;
  onSaveProfile?: (values: EditableProfileValues) => Promise<void>;
  onUploadProfilePhoto?: (file: File) => Promise<void>;
  onUploadCardBackground?: (file: File) => Promise<string>;
  onUploadSocialIcon?: (file: File) => Promise<string>;
  companyLogo?: string;
  companyInfoPath?: string;
}
