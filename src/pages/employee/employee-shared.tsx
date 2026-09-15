import type { ReactNode } from "react";
import { Button, Card, Select, Tooltip } from "antd";
import { BankOutlined, CloseOutlined, LinkOutlined, PlusOutlined } from "@ant-design/icons";
import { iconBox } from "../../features/employee/employee-card";

const PHONE_TYPES = ["İş", "Şəxsi", "WhatsApp", "Viber", "Telegram", "Ev"];
const SOCIAL_PLATFORMS = ["Instagram", "LinkedIn", "Facebook", "Twitter/X", "TikTok", "YouTube", "Website"];

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="employee-field-label">{children}</div>;
}

export function Section({ title, icon, accent = "#6366f1", children }: {
  title: string;
  icon: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <Card className="employee-section-card" styles={{ body: { padding: 0 } }}>
      <div className="employee-section-head" style={{ background: `linear-gradient(90deg, ${accent}14, #fff)` }}>
        <div style={iconBox(`${accent}18`, accent, 36)}>{icon}</div>
        <span className="employee-section-title">{title}</span>
      </div>
      <div className="employee-section-body">{children}</div>
    </Card>
  );
}

export function EmptyLine({ text = "Məlumat yoxdur" }: { text?: string }) {
  return <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>{text}</div>;
}

export function DynRow({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <div className="employee-dyn-row">
      {children}
      <button type="button" onClick={onRemove} className="employee-remove-btn">
        <CloseOutlined />
      </button>
    </div>
  );
}

export function AddBtn({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <Button icon={<PlusOutlined />} size="small" onClick={onClick} style={{ borderRadius: 999, borderColor: color, color, fontWeight: 800, marginTop: 4 }}>
      {label}
    </Button>
  );
}

export function CopyBtn({ text }: { text: string }) {
  return (
    <Tooltip title="Kopyalandı!" trigger="click">
      <Button
        icon={<LinkOutlined />}
        onClick={() => void navigator.clipboard.writeText(text || "")}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />
    </Tooltip>
  );
}

export function InfoRow({ icon, label, value, color = "#6366f1" }: { icon: ReactNode; label: string; value?: string; color?: string }) {
  return (
    <div className="employee-info-row">
      <div style={iconBox(`${color}16`, color, 38)}>{icon}</div>
      <div className="employee-info-content">
        <div className="employee-info-label">{label}</div>
        <Tooltip title={value || "-"}>
          <div className="employee-info-value">{value || "-"}</div>
        </Tooltip>
      </div>
    </div>
  );
}

export function CompanyInfoLine({ company }: { company: string }) {
  return (
    <div className="employee-info-row" style={{ marginTop: 12 }}>
      <BankOutlined style={{ color: "#6366f1", fontSize: 18 }} />
      <span style={{ color: "#64748b", fontSize: 13 }}>Şirkət:</span>
      <strong style={{ color: "#0f172a", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company || "-"}</strong>
    </div>
  );
}

export function SocialSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={onChange} style={{ width: "100%" }}>
      {SOCIAL_PLATFORMS.map(platform => <Select.Option key={platform} value={platform}>{platform}</Select.Option>)}
    </Select>
  );
}

export function PhoneTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={onChange} style={{ width: "100%" }}>
      {PHONE_TYPES.map(type => <Select.Option key={type} value={type}>{type}</Select.Option>)}
    </Select>
  );
}
