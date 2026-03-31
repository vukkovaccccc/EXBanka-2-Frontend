import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import Layout from '@/components/layout/Layout'

// Auth pages (public)
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import SetPasswordPage from '@/pages/auth/SetPasswordPage'

// Admin pages
import AdminPortal from '@/pages/admin/AdminPortal'
import EmployeeList from '@/pages/admin/EmployeeList'
import EditEmployee from '@/pages/admin/EditEmployee'
import CreateEmployee from '@/pages/admin/CreateEmployee'

// Role home pages
import EmployeePage from '@/pages/employee/EmployeePage'
import ClientPage from '@/pages/client/ClientPage'

// Client – Kartice
import KarticeListaPage from '@/pages/client/KarticeListaPage'

// Client – Krediti
import KreditiPage from '@/pages/client/krediti/KreditiPage'
import KreditZahtevForm from '@/pages/client/krediti/KreditZahtevForm'

// Employee – Krediti
import ZahteviZaKreditPage from '@/pages/employee/krediti/ZahteviZaKreditPage'
import SviKreditiPage from '@/pages/employee/krediti/SviKreditiPage'

// Employee – Aktuari
import ActuaryManagement from '@/pages/employee/actuaries/ActuaryManagement'

// Berze (shared: employees + clients)
import ExchangesPage from '@/pages/employee/ExchangesPage'

import NotFoundPage from '@/pages/NotFoundPage'

export default function AppRouter() {
  return (
    <Routes>
      {/* ── Public routes ─────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* ── Protected routes (require auth) ─────────────────────────── */}
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          {/* Admin portal – requires ADMIN role */}
          <Route
            path="/admin"
            element={<PrivateRoute requiredRole="ADMIN" />}
          >
            <Route index element={<AdminPortal />} />
            <Route path="employees" element={<EmployeeList />} />
            <Route path="employees/new" element={<CreateEmployee />} />
            <Route path="employees/:id/edit" element={<EditEmployee />} />
          </Route>

          {/* Employee home */}
          <Route
            path="/employee"
            element={<PrivateRoute requiredRole="EMPLOYEE" />}
          >
            <Route index element={<EmployeePage />} />
            <Route path="credits/requests" element={<ZahteviZaKreditPage />} />
            <Route path="credits/all" element={<SviKreditiPage />} />
            <Route path="actuaries" element={<ActuaryManagement />} />
            <Route path="exchanges" element={<ExchangesPage />} />
          </Route>

          {/* Client home */}
          <Route
            path="/client"
            element={<PrivateRoute requiredRole="CLIENT" />}
          >
            <Route index element={<ClientPage />} />
            <Route path="cards" element={<KarticeListaPage />} />
            <Route path="credits" element={<KreditiPage />} />
            <Route path="credits/new" element={<KreditZahtevForm />} />
            <Route path="exchanges" element={<ExchangesPage />} />
          </Route>
        </Route>
      </Route>

      {/* ── Fallback ──────────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
