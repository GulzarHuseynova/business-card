import { useMemo, useState } from "react";
import { Button, Form, Input, message, Modal } from "antd";
import { Navigate, Route, Routes } from "react-router";
import AppLayout from "../../components/Layout";
import { authOperations } from "../../helpers/auth.helper";
import { authSessionStorage } from "../../storage/auth-session.storage";
import type { ChangePasswordRequest } from "../../types/auth.type";
import type { EmployeeProps } from "../../types/employee.type";
import { EmployeeProvider } from "./employee-provider";
import { useEmployee } from "../../hooks/use-employee";
import { authActions, useAuthSelector } from "../../store/authStore";
import { getStoredUser } from "../../storage/auth.storage";
import { hasEmployeeCompletedPasswordChange, markEmployeePasswordChangeCompleted } from "../../features/auth/auth-login.helpers";
import EmployeeBusinessCard from "./employee-pages/business-card";
import EmployeeContacts from "./employee-pages/contacts";
import EmployeeIdentifiers from "./employee-pages/identifiers";
import EmployeeProfile from "./employee-pages/profile";
import "./employee.css";

const normalizeObjectKey = (value: string) => value.toLowerCase().replace(/[\s_.-]/g, "");

const findStringInObject = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== "object") return "";

  const wanted = keys.map(normalizeObjectKey);
  const queue: unknown[] = [source];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = normalizeObjectKey(key);
      if (wanted.includes(normalizedKey) && (typeof value === "string" || typeof value === "number")) {
        return String(value).trim();
      }

      if (value && typeof value === "object") queue.push(value);
    }
  }

  return "";
};

function EmployeePages() {
  return (
    <Routes>
      <Route index element={<Navigate to="business-card" replace />} />
      <Route path="business-card" element={<EmployeeBusinessCard />} />
      <Route path="profile" element={<EmployeeProfile />} />
      <Route path="contacts" element={<EmployeeContacts />} />
      <Route path="identifiers" element={<EmployeeIdentifiers />} />
      <Route path="*" element={<Navigate to="business-card" replace />} />
    </Routes>
  );
}

function EmployeeShell({ onLogout }: EmployeeProps) {
  const { card } = useEmployee();
  const [passwordForm] = Form.useForm<ChangePasswordRequest>();
  const accountInfo = useAuthSelector((state) => state.accountInfo);
  const companyVoen = useAuthSelector((state) => state.companyVoen);
  const userId = useAuthSelector((state) => state.userId);
  const role = useAuthSelector((state) => state.role);
  const storedUser = getStoredUser();

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordChangeCompleted, setPasswordChangeCompleted] = useState(false);

  const employeeEmail = useMemo(() => {
    return (
      storedUser?.email ||
      findStringInObject(accountInfo, ["email", "gmail", "userEmail", "mail", "emailAddress"]) ||
      userId ||
      ""
    );
  }, [accountInfo, storedUser?.email, userId]);

  const activeVoen = useMemo(() => {
    return (
      companyVoen ||
      storedUser?.companyVoen ||
      findStringInObject(accountInfo, ["companyVoen", "voen", "taxId", "taxNumber"]) ||
      ""
    );
  }, [accountInfo, companyVoen, storedUser?.companyVoen]);

  const shouldOpenPasswordModal = useMemo(() => {
    if (role !== "employee") return false;

    const employeeIdentity = userId || storedUser?.userId || storedUser?.id || employeeEmail;
    const alreadyChanged = passwordChangeCompleted || hasEmployeeCompletedPasswordChange(
      employeeEmail,
      activeVoen,
      employeeIdentity,
    );

    // Uğurlu ilk şifrə dəyişikliyi backend köhnə firstLogin=true qaytarsa belə
    // modalın sonrakı girişlərdə yenidən açılmasına üstünlük təşkil edir.
    if (alreadyChanged) return false;

    const account = accountInfo && typeof accountInfo === "object"
      ? (accountInfo as Record<string, unknown>)
      : {};

    const mustChangeFromUser = Boolean(
      storedUser?.mustChangePassword === true ||
        storedUser?.firstLogin === true ||
        storedUser?.isFirstLogin === true ||
        storedUser?.forcePasswordChange === true
    );

    const mustChangeFromAccount = [
      "mustChangePassword",
      "firstLogin",
      "isFirstLogin",
      "forcePasswordChange",
    ].some((key) => account[key] === true || account[key] === "true");

    return mustChangeFromUser || mustChangeFromAccount;
  }, [accountInfo, activeVoen, employeeEmail, passwordChangeCompleted, role, storedUser?.firstLogin, storedUser?.forcePasswordChange, storedUser?.id, storedUser?.isFirstLogin, storedUser?.mustChangePassword, storedUser?.userId, userId]);

  const handlePasswordChange = async (values: ChangePasswordRequest) => {
    try {
      setPasswordLoading(true);

      await authOperations.changePassword({
        ...values,
        email: employeeEmail,
        companyVoen: activeVoen,
      });

      markEmployeePasswordChangeCompleted(
        employeeEmail,
        activeVoen,
        userId || storedUser?.userId || storedUser?.id || employeeEmail,
      );

      const nextAccountInfo = accountInfo && typeof accountInfo === "object"
        ? {
            ...accountInfo,
            mustChangePassword: false,
            firstLogin: false,
            isFirstLogin: false,
            forcePasswordChange: false,
          }
        : accountInfo;

      authActions.setAccountInfo(nextAccountInfo);
      passwordForm.resetFields();
      setPasswordChangeCompleted(true);
      message.success("Şifrə təyin edildi. Yeni şifrə ilə daxil olun.");

      authSessionStorage.clear();

      if (onLogout) {
        onLogout();
      }

      window.location.replace("/login");
      return;
    } catch {
      message.error("Şifrə dəyişdirilmədi. Köhnə kod/şifrəni və yeni şifrəni yoxlayın.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: "Çıxış etmək istəyirsiniz?",
      content: "Sistemdən çıxış edəcəksiniz.",
      okText: "Bəli",
      cancelText: "Xeyr",
      okButtonProps: { danger: true },
      onOk: () => {
        authSessionStorage.clear();
        if (onLogout) onLogout();
        else window.location.href = "/login";
      },
    });
  };

  return (
    <>
      <AppLayout
        role="employee"
        onLogout={handleLogout}
        titleSuffix={card.company || "Vizitkart"}
        userName={`${card.firstName} ${card.lastName}`.trim() || "Əməkdaş"}
        avatarText={card.firstName?.[0] || "E"}
        avatarSrc={card.photo}
        notificationCount={1}
      >
        <EmployeePages />
      </AppLayout>

      <Modal
        rootClassName="employee-first-password-modal"
        title="İlk giriş üçün şifrəni dəyişin"
        open={shouldOpenPasswordModal}
        footer={null}
        closable={false}
        mask={{ closable: false }}
        keyboard={false}
        width={480}
        centered
      >
        <p style={{ color: "#64748b", marginTop: 0 }}>
          Company Admin tərəfindən verilən kod müvəqqətidir. Employee panelindən istifadə etmək üçün yeni şifrə təyin edin.
        </p>

        <Form<ChangePasswordRequest>
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            name="currentPassword"
            label="Köhnə kod / şifrə"
            rules={[{ required: true, message: "Köhnə kodu daxil edin" }]}
          >
            <Input.Password placeholder="Company Admin-in verdiyi kod" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Yeni şifrə"
            rules={[
              { required: true, message: "Yeni şifrə daxil edin" },
              { min: 6, message: "Yeni şifrə ən azı 6 simvol olmalıdır" },
            ]}
          >
            <Input.Password placeholder="Yeni şifrə" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Yeni şifrəni təkrar yazın"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Yeni şifrəni təkrar yazın" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("Şifrələr eyni deyil"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Yeni şifrə təkrar" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={passwordLoading} block>
            Şifrəni dəyiş
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export default function Employee({ onLogout }: EmployeeProps) {
  return (
    <EmployeeProvider>
      <EmployeeShell onLogout={onLogout} />
    </EmployeeProvider>
  );
}
