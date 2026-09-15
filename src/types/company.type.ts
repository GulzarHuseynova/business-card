export interface AddUserPayload {
  companyId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  jobTitle: string;
  phone1: string;
  phone2?: string;
  extensionNumber?: string;
  whatsapp?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  photoFile?: File;
  email: string;
  password?: string;
  companyName?: string;
  companyVoen?: string;
  role: number;
  isActive: boolean;
  canEdit?: boolean;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  cardBackgroundUrl?: string;
  cardBackgroundFile?: File;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  jobTitle?: string;
  phone1?: string;
  phone2?: string;
  extensionNumber?: string;
  whatsapp?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  photoFile?: File;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  cardBackgroundUrl?: string;
  cardBackgroundFile?: File;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
}

export interface CompanyInfo {
  id?: string;
  companyId?: string;
  name?: string;
  companyName?: string;
  industry?: string;
  logo?: string;
  logoUrl?: string;
  employeeLimit?: number;
  limit?: number;
  userLimit?: number;
  status?: string;
  voen?: string;
  companyVoen?: string;
  address?: string;
  contact?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  nfcBaseUrl?: string;
}

export interface NormalizedCompanyInfo {
  id: string;
  name: string;
  employeeLimit: number;
  logo: string;
  industry: string;
  status: string;
  voen: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  nfcBaseUrl: string;
}

export interface NormalizedUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  jobTitle: string;
  phone1: string;
  phone2: string;
  extensionNumber: string;
  email: string;
  isActive: boolean;
  canEdit: boolean;
  role?: string | number;
  whatsapp?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  scans?: number;
  scanCount?: number;
  companyId?: string;
  companyName?: string;
  companyVoen?: string;
  qrUid?: string;
  qrCode?: string;
  cardUid?: string;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  cardBackgroundUrl?: string;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
}
