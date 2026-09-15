import type { NormalizedUser } from './company.type';

export type HtmlExportEmployee = Pick<
  NormalizedUser,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'email'
  | 'photo'
  | 'photoUrl'
  | 'photoData'
  | 'companyId'
  | 'companyVoen'
  | 'jobTitle'
  | 'phone1'
  | 'phone2'
  | 'whatsapp'
  | 'extensionNumber'
  | 'companyName'
  | 'address'
  | 'googleMapsUrl'
  | 'cardBackgroundUrl'
  | 'dateOfBirth'
  | 'additionalInfo'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'socialAccounts'
>;

export interface ExportedEmployeePhotoRow {
  employee: HtmlExportEmployee;
  photo: string;
}

