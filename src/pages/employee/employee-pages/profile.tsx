import { EmployeeHero, EmployeePageHeader, EmployeePageState, PersonalInfoSection } from "../employee-sections";

export default function EmployeeProfile() {
  return (
    <EmployeePageState>
      <EmployeePageHeader title="Şəxsi məlumat" description="Ad, soyad, vəzifə və daxili nömrəni burada idarə et." />
      <div className="employee-grid-2">
        <EmployeeHero />
        <PersonalInfoSection />
      </div>
    </EmployeePageState>
  );
}
