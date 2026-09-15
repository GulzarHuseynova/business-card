import { createContext, useContext } from "react";
import type { CompanyAdminContextValue } from "../types/company-admin.type";

export const CompanyAdminContext = createContext<CompanyAdminContextValue | null>(null);

export function useCompanyAdmin() {
  const context = useContext(CompanyAdminContext);

  if (!context) {
    throw new Error("useCompanyAdmin CompanyAdminProvider daxilində istifadə olunmalıdır.");
  }

  return context;
}
