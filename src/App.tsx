import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireApp, RequireCompanyChoice, RequirePendingMfa } from './auth/guards';
import { useSession, useStaff } from './auth/SessionProvider';
import { AppShell } from './layout/AppShell';
import { ChooseCompanyPage } from './pages/auth/ChooseCompanyPage';
import { ChoosePasswordPage } from './pages/auth/ChoosePasswordPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { MfaSetupPage, MfaVerifyPage } from './pages/auth/MfaPages';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';
import { CompaniesListPage } from './pages/companies/CompaniesListPage';
import { CompanyFormPage } from './pages/companies/CompanyFormPage';
import { OwnerUsersPage } from './pages/companies/OwnerUsersPage';
import { AuditPage } from './pages/audit/AuditPage';
import { AssignedCompanyBooksPage } from './pages/books/AssignedCompanyBooksPage';
import { CompanyBooksPage } from './pages/books/CompanyBooksPage';
import { SupportSessionsPage } from './pages/support/SupportSessionsPage';
import { CompanyHome, StaffDashboard } from './pages/HomePages';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReferencePage } from './pages/reference/ReferencePage';
import { StaffEditPage } from './pages/staff/StaffEditPage';
import { StaffListPage } from './pages/staff/StaffListPage';
import { isPlatformAdmin } from './types';

function StaffGate({ admin, children }: { admin: boolean; children: ReactNode }) {
  const staff = useStaff();
  if (!staff || isPlatformAdmin(staff.staff_role) !== admin) return <NotFoundPage />;
  return <>{children}</>;
}

function AnyStaffGate({ children }: { children: ReactNode }) {
  if (!useStaff()) return <NotFoundPage />;
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
      <PasswordChangeGate>
        <AppRoutes />
      </PasswordChangeGate>
    </BrowserRouter>
  );
}

function PasswordChangeGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'mustChangePassword') return <ChoosePasswordPage />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/reset-password" element={<SetPasswordPage />} />
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
            <Route path="my-companies/:id" element={<StaffGate admin={false}><AssignedCompanyBooksPage /></StaffGate>} />
            <Route path="staff" element={<StaffGate admin><StaffListPage /></StaffGate>} />
            <Route path="staff/:id" element={<StaffGate admin><StaffEditPage /></StaffGate>} />
            <Route path="support-sessions" element={<StaffGate admin><SupportSessionsPage /></StaffGate>} />
            <Route path="reference" element={<AnyStaffGate><ReferencePage /></AnyStaffGate>} />
            <Route path="audit" element={<StaffGate admin><AuditPage mode="all" /></StaffGate>} />
            <Route path="users" element={<OwnerUsersPage />} />
            <Route path="activity" element={<AuditPage mode="company" />} />
            <Route path="projects" element={<CompanyBooksPage key="projects" section="projects" />} />
            <Route path="clients" element={<CompanyBooksPage key="clients" section="clients" />} />
            <Route path="cash-accounts" element={<CompanyBooksPage key="cash" section="cash" />} />
            <Route path="payments" element={<CompanyBooksPage key="payments" section="payments" />} />
            <Route path="expenses" element={<CompanyBooksPage key="expenses" section="expenses" />} />
            <Route path="fee-charges" element={<CompanyBooksPage key="fees" section="fees" />} />
            <Route path="months" element={<CompanyBooksPage key="months" section="months" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
  );
}
