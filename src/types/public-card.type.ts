export type ScanSource = 'QR' | 'NFC' | 'Direct';
export type QrDownloadFormat = 'png' | 'svg' | 'pdf';

export interface PublicContactPhone {
  type: string;
  number: string;
}

export interface PublicContactSocial {
  platform: string;
  url: string;
  iconUrl?: string;
}

export interface PublicContactExtra {
  label: string;
  value: string;
}

export interface PublicCardProfile {
  id: string;
  employeeId: string;
  companyId: string;
  companyVoen: string;
  companyName: string;
  companyLogo: string;
  firstName: string;
  lastName: string;
  middleName: string;
  jobTitle: string;
  email: string;
  photo: string;
  cardBackground: string;
  dateOfBirth: string;
  address: string;
  googleMapsUrl: string;
  phones: PublicContactPhone[];
  socials: PublicContactSocial[];
  extras: PublicContactExtra[];
  nfcUrl: string;
  qrUid: string;
  cardUrl: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  scans: number;
  updatedAt: string;
}

export interface PublicScanLog {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  email: string;
  companyId: string;
  companyVoen: string;
  source: ScanSource;
  os: string;
  status: 'active' | 'inactive';
  details: string;
  cardId: string;
}
