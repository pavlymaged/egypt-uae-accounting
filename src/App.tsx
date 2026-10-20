import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireApp, RequireCompanyChoice, RequirePendingMfa } from './auth/guards';
import { useSession, useStaff } from './auth/SessionProvider';
import { AppShell } from './layout/AppShell';
import { ChooseCompanyPage } from './pages/auth/ChooseCompanyPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { MfaSetupPage, MfaVerifyPage } from './pages/auth/MfaPages';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { CompaniesListPage } from './pages/companies/CompaniesListPage';
import { CompanyFormPage } from './pages/companies/CompanyFormPage';
import { CompanyHome, StaffDashboard } from './pages/HomePages';
import { NotFoundPage } from './pages/NotFoundPage';
import { StaffEditPage } from './pages/staff/StaffEditPage';
import { StaffListPage } from './pages/staff/StaffListPage';
import { isPlatformAdmin } from './types';

function StaffGate({ admin, children }: { admin: boolean; children: ReactNode }) {
  const staff = useStaff();
  if (!staff || isPlatformAdmin(staff.staff_role) !== admin) return <NotFoundPage />;
  return <>{children}</>;
}

function HomeRoute() {
  const staff = useStaff();
  return staff ? <StaffDashboard staff={staff} /> : <CompanyHome />;
}

function useEmail(): string {
  return useSession().session?.user.email ?? '';
}

function MfaSetupRoute() {
  const email = useEmail();
  return <RequirePendingMfa>{(id) => <MfaSetupPage hasVerifiedFactor={id.hasVerifiedFactor} email={email} />}</RequirePendingMfa>;
}

function MfaVerifyRoute() {
  const email = useEmail();
  return <RequirePendingMfa>{(id) => <MfaVerifyPage hasVerifiedFactor={id.hasVerifiedFactor} email={email} />}</RequirePendingMfa>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/mfa/setup" element={<MfaSetupRoute />} />
        <Route path="/mfa/verify" element={<MfaVerifyRoute />} />
        <Route path="/choose-company" element={<RequireCompanyChoice><ChooseCompanyPage /></RequireCompanyChoice>} />

        <Route element={<RequireApp />}>
          <Route element={<AppShell />}>
            <Route index element={<HomeRoute />} />
            <Route path="companies" element={<StaffGate admin><CompaniesListPage mode="all" /></StaffGate>} />
            <Route path="companies/new" element={<StaffGate admin><CompanyFormPage /></StaffGate>} />
            <Route path="companies/:id" element={<StaffGate admin><CompanyFormPage /></StaffGate>} />
            <Route path="my-companies" element={<StaffGate admin={false}><CompaniesListPage mode="mine" /></StaffGate>} />
            <Route path="staff" element={<StaffGate admin><StaffListPage /></StaffGate>} />
            <Route path="staff/:id" element={<StaffGate admin><StaffEditPage /></StaffGate>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
