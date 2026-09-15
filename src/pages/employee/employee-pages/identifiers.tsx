import { EmployeePageHeader, EmployeePageState, IdentifiersSection } from "../employee-sections";

export default function EmployeeIdentifiers() {
  return (
    <EmployeePageState>
      <EmployeePageHeader title="QR və NFC" description="QR UID və NFC URL identifikatorlarını burada gör və redaktə et." />
      <IdentifiersSection />
    </EmployeePageState>
  );
}
