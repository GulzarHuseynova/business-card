import type { UserData } from './company-admin.type';

export type EmployeeStatusTab = 'active' | 'inactive';
export type ExportLoadingType = 'excel' | 'excelSelected' | 'html' | 'htmlSelected' | null;
export type BusinessCardTableRow = UserData & { __tableRowKey: string };

export interface TablePaginationState {
  current: number;
  pageSize: number;
}

export interface ImportResultState {
  success: number;
  errors: string[];
}
