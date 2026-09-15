import {
  EmployeeHero,
  EmployeePageState,
  ExtraInfoSection,
  IdentifiersSection,
  PersonalInfoSection,
  PhonesSection,
  SocialsSection,
} from "../employee-sections";

export default function EmployeeBusinessCard() {
  return (
    <EmployeePageState>
      <div className="employee-page-wrap">
        <EmployeeHero />

        <div className="employee-grid-2">
          <div className="employee-stack">
            <PersonalInfoSection />
            <SocialsSection />
          </div>

          <div className="employee-stack">
            <PhonesSection />
            <ExtraInfoSection />
            <IdentifiersSection />
          </div>
        </div>
      </div>
    </EmployeePageState>
  );
}
