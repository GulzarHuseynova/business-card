export interface LocalCompanyAdminAccount {
  companyId: string;
  companyName: string;
  voen: string;
  adminName: string;
  gmail: string;
  phone?: string;
  password: string;
  logo?: string;
  logoUrl?: string;
  address?: string;
  contact?: string;
  employeeLimit?: number;
  mustChangePassword?: boolean;
  firstLogin?: boolean;
  isFirstLogin?: boolean;
}


export interface LocalEmployeeAccount {
  id: string;
  companyId: string;
  companyName: string;
  voen: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  jobTitle: string;
  email: string;
  password: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  extensionNumber?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  isActive: boolean;
  canEdit: boolean;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  cardBackground?: string;
  cardBackgroundUrl?: string;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
  scans?: number;
  mustChangePassword?: boolean;
  firstLogin?: boolean;
  isFirstLogin?: boolean;
  forcePasswordChange?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalAuditLog {
  id: string;
  date: string;
  userName: string;
  userId?: string;
  actionType: string;
  entity?: string;
  beforeValue?: string;
  afterValue?: string;
  details: string;
  companyId?: string;
  companyVoen?: string;
}

export interface LocalEmployeeOverride {
  id: string;
  email?: string;
  companyId?: string;
  companyVoen?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  jobTitle?: string;
  phone1?: string;
  phone2?: string;
  whatsapp?: string;
  extensionNumber?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  socialAccounts?: Array<{ platformName?: string; profileUrl?: string; iconUrl?: string }>;
  photo?: string;
  photoUrl?: string;
  photoData?: string;
  cardBackground?: string;
  cardBackgroundUrl?: string;
  additionalInfo?: string;
  dateOfBirth?: string;
  address?: string;
  googleMapsUrl?: string;
  isActive?: boolean;
  canEdit?: boolean;
  updatedAt?: string;
}
