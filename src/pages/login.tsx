import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AutoComplete, Button, Form, Input, message } from "antd";
import {ArrowRightOutlined,BankOutlined,LockOutlined,MailOutlined,SafetyCertificateOutlined,} from "@ant-design/icons";
import { authOperations } from "../helpers/auth.helper";
import { readLocalCompanyAdminAccounts } from "../storage/local-auth/company-admin-local-auth";
import { readLocalEmployeeAccounts } from "../storage/local-auth/employee-local-auth";
import { authSessionStorage } from "../storage/auth-session.storage";
import { authActions, normalizeRole } from "../store/authStore";
import type { LoginFormValues, LoginProps, LoginResponse } from "../types/auth.type";
import { MOCK_LOGIN_HELP } from "../mock/mock.data";
import "./login.css";

const hexItems = Array.from({ length: 7 }, (_, index) => index);

const normalizeVoenOption = (value?: unknown) => String(value || '').trim();

const getLoginVoenOptions = () => {
  const options = new Map<string, string>();

  readLocalCompanyAdminAccounts().forEach((account) => {
    const voen = normalizeVoenOption(account.voen);
    if (!voen) return;
    options.set(voen, `${voen} — ${account.companyName || 'Şirkət'}`);
  });

  readLocalEmployeeAccounts().forEach((employee) => {
    const voen = normalizeVoenOption(employee.voen);
    if (!voen) return;
    options.set(voen, `${voen} — ${employee.companyName || 'Şirkət'}`);
  });

  MOCK_LOGIN_HELP.forEach((account) => {
    const voen = normalizeVoenOption(account.voen);
    if (!voen) return;
    options.set(voen, `${voen} — Mock demo`);
  });

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
};

function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [voenOptions, setVoenOptions] = useState(() => getLoginVoenOptions());

  useEffect(() => {
  document.body.classList.add("login-page-lock");

  return () => {
    document.body.classList.remove("login-page-lock");
  };
}, []);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);

    try {
      const companyVoen = values.companyVoen?.trim() || "";

      const response: LoginResponse = await authOperations.login({
        email: values.email,
        password: values.password,
        companyVoen,
      });

      const role = normalizeRole(response.role);

      if (!role) {
        throw new Error("Hesab rolu müəyyən edilmədi.");
      }

      const rawAccountInfo = response.accountInfo && typeof response.accountInfo === "object"
        ? response.accountInfo
        : null;

      const effectiveCompanyVoen = normalizeVoenOption(response.companyVoen || companyVoen || rawAccountInfo?.companyVoen || rawAccountInfo?.voen);
      if ((role === "company-admin" || role === "employee") && !effectiveCompanyVoen) {
        throw new Error("CompanyAdmin və Employee hesabı üçün VÖEN seçilməlidir.");
      }

      const canRequirePasswordChange = role === "company-admin" || role === "employee";
      const firstLogin = canRequirePasswordChange
        ? Boolean(
          response.isFirstLogin ||
          response.firstLogin ||
          response.mustChangePassword ||
          rawAccountInfo?.isFirstLogin === true ||
          rawAccountInfo?.firstLogin === true ||
          rawAccountInfo?.mustChangePassword === true ||
          rawAccountInfo?.forcePasswordChange === true
        )
        : false;

      const accountInfo = canRequirePasswordChange
        ? {
          ...(rawAccountInfo || {}),
          email: rawAccountInfo?.email || rawAccountInfo?.gmail || values.email.trim().toLowerCase(),
          gmail: rawAccountInfo?.gmail || rawAccountInfo?.email || values.email.trim().toLowerCase(),
          companyVoen: effectiveCompanyVoen,
          voen: effectiveCompanyVoen,
          mustChangePassword: firstLogin,
          firstLogin,
          isFirstLogin: firstLogin,
          forcePasswordChange: firstLogin,
        }
        : rawAccountInfo;

      authActions.setSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || "",
        role,
        companyId: response.companyId || "",
        userId: response.userId || "",
        companyVoen: effectiveCompanyVoen,
        accountInfo,
      });

      const homePath =
        role === "employee"
          ? "/employee/business-card"
          : role === "company-admin"
            ? "/company-admin/company"
            : "/admin/statistics";

      message.success("Sistemə uğurla giriş etdiniz!");
      onLoginSuccess();
      navigate(homePath, { replace: true });
    } catch (error) {
      authSessionStorage.clear();
      const detail = error instanceof Error ? error.message : "";
      message.error(detail || "E-poçt, kod və ya VÖEN yanlışdır!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-shell">
        <aside className="login-hero">
          <div className="login-grid" />
          <div className="login-glow login-glow-cyan" />
          <div className="login-glow login-glow-purple" />

          <img className="login-brand-logo" src="/setclapp-logo.svg" alt="SetClapp" />

          <div className="login-hex-orb" aria-hidden="true">
            <div className="login-orb-backdrop" />
            {hexItems.map((item) => (
              <span key={item} className={`login-hex login-hex-${item + 1}`} />
            ))}
          </div>

          <div className="login-hero-content">
            <h1>Rəqəmsal biznesinizi inamla idarə edin</h1>
            <p>
              SetClapp əməliyyatları sadələşdirməyə, uyğunluğu təmin etməyə və inkişafı
              vahid platformada sürətləndirməyə kömək edir.
            </p>
          </div>

          <div className="login-wave-field" aria-hidden="true" />
        </aside>

        <main className="login-form-side">
          <div className="login-card">
            <div className="login-lock-badge">
              <SafetyCertificateOutlined />
            </div>

            <h2>Xoş gəlmisiniz</h2>
            <p className="login-card-subtitle">SetClapp hesabınıza davam etmək üçün daxil olun</p>

            <Form<LoginFormValues> layout="vertical" className="login-form" onFinish={onFinish} onFocus={() => setVoenOptions(getLoginVoenOptions())}>
              <Form.Item
                label="E-poçt"
                name="email"
                rules={[
                  { required: true, message: "E-poçt daxil edin" },
                  { type: "email", message: "Yanlış e-poçt formatı" },
                ]}
              >
                <Input
                  className="login-input"
                  prefix={<MailOutlined />}
                  placeholder="siz@example.com"
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                label="Kod"
                name="password"
                rules={[{ required: true, message: "Şifrə və ya kod daxil edin" }]}
              >
                <Input.Password
                  className="login-input"
                  prefix={<LockOutlined />}
                  placeholder="Kodunuzu daxil edin"
                  autoComplete="current-password"
                  visibilityToggle={{
                    visible: showPassword,
                    onVisibleChange: setShowPassword,
                  }}
                />
              </Form.Item>

              <Form.Item
                label="VÖEN"
                name="companyVoen"
                rules={[
                  {
                    pattern: /^\d{5,20}$/,
                    message: "VÖEN 5-20 rəqəmdən ibarət olmalıdır!",
                  },
                ]}
                extra="Super Admin üçün boş saxlayın. CompanyAdmin və Employee VÖEN seçərək daxil olur."
              >
                <AutoComplete
                  className="login-input"
                  options={voenOptions}
                  placeholder="VÖEN seçin"
                  maxLength={20}
                  filterOption={(inputValue, option) =>
                    String(option?.value || "").includes(inputValue) ||
                    String(option?.label || "").toLowerCase().includes(inputValue.toLowerCase())
                  }
                  onOpenChange={(open) => {
                    if (open) setVoenOptions(getLoginVoenOptions());
                  }}
                >
                  <Input prefix={<BankOutlined />} />
                </AutoComplete>
              </Form.Item>

              <Button className="login-button" type="primary" htmlType="submit" loading={loading} block>
                <span>Daxil ol</span>
                <ArrowRightOutlined />
              </Button>
            </Form>

            <p className="login-terms">
              Daxil olmaqla, <span>Xidmət Şərtlərimizi</span> qəbul edirsiniz və <span>Məxfilik
                Siyasətimizi</span> təsdiqləyirsiniz.
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}

export default Login;
