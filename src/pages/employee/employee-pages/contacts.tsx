import { EmployeePageHeader, EmployeePageState, ExtraInfoSection, PhonesSection, SocialsSection } from "../employee-sections";

export default function EmployeeContacts() {
  return (
    <EmployeePageState>
      <EmployeePageHeader title="Əlaqə məlumatları" description="Telefon nömrələri, sosial linklər və əlavə məlumatları burada dəyiş." />
      <div className="employee-grid-2">
        <div className="employee-stack">
          <PhonesSection />
          <ExtraInfoSection />
        </div>
        <SocialsSection />
      </div>
    </EmployeePageState>
  );
}
