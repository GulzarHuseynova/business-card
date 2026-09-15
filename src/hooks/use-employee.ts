import { createContext, useContext } from "react";
import type { EmployeeContextValue } from "../types/employee.type";

export const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function useEmployee() {
  const context = useContext(EmployeeContext);

  if (!context) {
    throw new Error("useEmployee EmployeeProvider daxilində istifadə olunmalıdır.");
  }

  return context;
}
