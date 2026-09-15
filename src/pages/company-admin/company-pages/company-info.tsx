import { useEffect, useState } from "react";
import { Button, Form, Input, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useCompanyAdmin } from "../../../hooks/use-company-admin";
import type { CompanyFormValues } from "../../../types/company-admin.type";

const isBrokenBackendLogo = () => false;

function CompanyLogoPreview({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState("");

  const canShowImage = Boolean(src) && failedSrc !== src && !isBrokenBackendLogo();
  const initials = (name || "Ş").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Ş";

  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        background: "linear-gradient(135deg,#6d7f8d,#f6fbff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#4b9ada",
        fontSize: 30,
        fontWeight: 900,
      }}
    >
      {canShowImage ? (
        <img
          src={src}
          alt={name || "Şirkət loqosu"}
          onError={() => setFailedSrc(src || "")}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: "10px" }}
        />
      ) : initials}
    </div>
  );
}

export default function CompanyInfo() {
  const { company, saveCompany, uploadCompanyLogo } = useCompanyAdmin();
  const [companyForm] = Form.useForm<CompanyFormValues>();

  useEffect(() => {
    companyForm.setFieldsValue({
      name: company.name,
      industry: company.industry,
      address: company.address,
      contact: company.contact,
      email: company.email,
      phone: company.phone,
      nfcBaseUrl: company.nfcBaseUrl,
    });
  }, [company, companyForm]);

  return (
    <div className="pro-page pro-company-info-page pro-panel" style={{ background: "#fff", borderRadius: 14, padding: 32, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h2 style={{ marginTop: 0 }}>Şirkət məlumatları və ayarlar</h2>

      <Form layout="vertical" form={companyForm} onFinish={saveCompany}>
        <div style={{ display: "grid", gap: 24, justifyItems: "center" }}>
          <div className="pro-company-logo-block" style={{ width: "fit-content", margin: "0 auto", textAlign: "center", display: "grid", justifyItems: "center", alignContent: "start", gap: 8 }}>
            <CompanyLogoPreview src={company.logo} name={company.name} />
            <Upload
              showUploadList={false}
              accept="image/png,image/jpeg,image/svg+xml"
              maxCount={1}
              beforeUpload={(file) => {
                const isAllowedImage = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/svg+xml";

                if (!isAllowedImage) {
                  message.error("Yalnız JPG, PNG və SVG formatında loqo yükləyə bilərsiniz.");
                  return Upload.LIST_IGNORE;
                }

                void uploadCompanyLogo(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: 12 }}>Loqonu yenilə</Button>
            </Upload>
          </div>

          <div className="pro-company-form-block" style={{ width: "100%", minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
              <Form.Item label="Şirkətin adı" name="name"><Input size="large" /></Form.Item>
              <Form.Item label="Fəaliyyət sahəsi" name="industry"><Input size="large" /></Form.Item>
              <Form.Item label="Ünvan" name="address"><Input size="large" /></Form.Item>
              <Form.Item label="Email" name="email"><Input size="large" /></Form.Item>
              <Form.Item label="Telefon" name="phone"><Input size="large" /></Form.Item>
              <Form.Item
                label="NFC əsas linki"
                name="nfcBaseUrl"
                tooltip="İşçilərin NFC linkləri bu əsas ünvan üzərindən yaradılacaq."
                rules={[{ type: "url", warningOnly: true, message: "Düzgün URL yazın" }]}
              >
                <Input size="large" placeholder="https://example.com/card" />
              </Form.Item>
              <Form.Item label="Əməkdaş limiti"><Input size="large" value={`${company.employeeLimit || "-"} nəfər`} disabled /></Form.Item>
              <Form.Item label="Status"><Input size="large" value={company.status} disabled /></Form.Item>
            </div>

            <Button type="primary" htmlType="submit" size="large">Dəyişiklikləri yadda saxla</Button>
          </div>
        </div>
      </Form>
    </div>
  );
}