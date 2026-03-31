import { createBrowserRouter, RouterProvider, Route, Navigate, createRoutesFromElements } from 'react-router-dom'
import PrivateRoute from './router/PrivateRoute'
import Layout from '@/components/layout/Layout'

// Auth pages (public)
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ActivatePage from '@/pages/auth/ActivatePage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'

// Admin pages
import AdminPortal from '@/pages/admin/AdminPortal'
import EmployeeList from '@/pages/admin/EmployeeList'
import EditEmployee from '@/pages/admin/EditEmployee'
import CreateEmployee from '@/pages/admin/CreateEmployee'

// Role home pages
import EmployeePage from '@/pages/employee/EmployeePage'
import CreateClient from '@/pages/employee/CreateClient'
import ClientListPage from '@/pages/employee/ClientListPage'
import ClientDetailPage from '@/pages/employee/ClientDetailPage'
import EditClient from '@/pages/employee/EditClient'
import CreateAccount from '@/pages/employee/CreateAccount'
import ClientPage from '@/pages/client/ClientPage'
import AccountsPage from '@/pages/client/AccountsPage'
import AccountDetailPage from '@/pages/client/AccountDetailPage'
import PrimaociPage from '@/pages/client/payments/PrimaociPage'
import NovoPlacanjeWizard from '@/pages/client/payments/NovoPlacanjeWizard'
import PrenosPage from '@/pages/client/payments/PrenosPage'
import PregledPlacanja from '@/pages/client/payments/PregledPlacanja'
import MenjacnicaPage from '@/pages/client/MenjacnicaPage'

// Client – Kartice
import KarticeListaPage from '@/pages/client/KarticeListaPage'

// Client – Krediti
import KreditiPage from '@/pages/client/krediti/KreditiPage'
import KreditZahtevForm from '@/pages/client/krediti/KreditZahtevForm'

// Employee – Računi i kartice
import AccountsListPage from '@/pages/employee/AccountsListPage'
import AccountCardsPage from '@/pages/employee/AccountCardsPage'

// Employee – Krediti
import ZahteviZaKreditPage from '@/pages/employee/krediti/ZahteviZaKreditPage'
import SviKreditiPage from '@/pages/employee/krediti/SviKreditiPage'

// Employee – Aktuari
import ActuaryManagement from '@/pages/employee/actuaries/ActuaryManagement'

// Berze (shared: employees + clients)
import ExchangesPage from '@/pages/employee/ExchangesPage'

import NotFoundPage from '@/pages/NotFoundPage'

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* ── Public routes ─────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Protected routes (require auth) ─────────────────────────── */}
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          {/* Admin portal – requires ADMIN role */}
          <Route path="/admin" element={<PrivateRoute requiredRole="ADMIN" />}>
            <Route index element={<AdminPortal />} />
            <Route path="employees" element={<EmployeeList />} />
            <Route path="employees/new" element={<CreateEmployee />} />
            <Route path="employees/:id/edit" element={<EditEmployee />} />
          </Route>

          {/* Employee home */}
          <Route path="/employee" element={<PrivateRoute requiredRole="EMPLOYEE" />}>
            <Route index element={<EmployeePage />} />
            <Route path="clients" element={<ClientListPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="clients/:id/edit" element={<EditClient />} />
            <Route path="clients/new" element={<CreateClient />} />
            <Route path="accounts/new" element={<CreateAccount />} />
            <Route path="accounts" element={<AccountsListPage />} />
            <Route path="accounts/:broj_racuna/cards" element={<AccountCardsPage />} />
            <Route path="credits/requests" element={<ZahteviZaKreditPage />} />
            <Route path="credits/all" element={<SviKreditiPage />} />
            <Route path="actuaries" element={<ActuaryManagement />} />
            <Route path="exchanges" element={<ExchangesPage />} />
          </Route>

          {/* Client home */}
          <Route path="/client" element={<PrivateRoute requiredRole="CLIENT" />}>
            <Route index element={<ClientPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="accounts/:id" element={<AccountDetailPage />} />
            <Route path="payments/new" element={<NovoPlacanjeWizard />} />
            <Route path="payments/transfer" element={<PrenosPage />} />
            <Route path="payments/recipients" element={<PrimaociPage />} />
            <Route path="payments/history" element={<PregledPlacanja />} />
            <Route path="cards" element={<KarticeListaPage />} />
            <Route path="credits" element={<KreditiPage />} />
            <Route path="credits/new" element={<KreditZahtevForm />} />
            <Route path="exchange" element={<MenjacnicaPage />} />
            <Route path="exchanges" element={<ExchangesPage />} />
          </Route>
        </Route>
      </Route>

      {/* ── Fallback ──────────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
)

export default function App() {
  return <RouterProvider router={router} />
}
