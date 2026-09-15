import type { ChangeEvent, RefObject } from "react";

export interface CardPhone {
  type: string;
  number: string;
}

export interface CardSocial {
  platform: string;
  url: string;
}

export interface CardExtra {
  label: string;
  value: string;
}

export interface CardData {
  photo: string;
  companyLogo: string;
  cardBackground: string;
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  company: string;
  internalNumber: string;
  phones: CardPhone[];
  socials: CardSocial[];
  extras: CardExtra[];
  nfcUrl: string;
  qrUid: string;
}

export interface EmployeeProps {
  onLogout?: () => void;
}

export interface EmployeeListActions<T> {
  add: (item: T) => void;
  remove: (index: number) => void;
  update: (index: number, field: keyof T, value: string) => void;
}

export interface EmployeeContextValue {
  editing: boolean;
  loading: boolean;
  loadError: string;
  card: CardData;
  draft: CardData;
  currentCard: CardData;
  fullName: string;
  canEditCard: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  backgroundFileRef: RefObject<HTMLInputElement | null>;
  backgroundUploading: boolean;
  setField: <K extends keyof CardData>(key: K, value: CardData[K]) => void;
  phoneOps: EmployeeListActions<CardPhone>;
  socialOps: EmployeeListActions<CardSocial>;
  extraOps: EmployeeListActions<CardExtra>;
  handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCardBackground: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  startEdit: () => void;
  save: () => Promise<void>;
  cancel: () => void;
}
