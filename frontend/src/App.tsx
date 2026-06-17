import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from './stores/authStore'
import MainLayout from './components/MainLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import TicketsPage from './pages/TicketsPage'
import MonitoringPage from './pages/MonitoringPage'
import KnowledgePage from './pages/KnowledgePage'
import AutomationPage from './pages/AutomationPage'
import ChatbotPage from './pages/ChatbotPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import PrototypeModulePage from './pages/PrototypeModulePage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/system/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Login */}
      <Route path="/system/login" element={<LoginPage />} />

      {/* Protected system routes */}
      <Route
        path="/system/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/system/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="ipam" element={<PrototypeModulePage type="ipam" />} />
        <Route path="software-catalog" element={<PrototypeModulePage type="software-catalog" />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="network" element={<PrototypeModulePage type="network" />} />
        <Route path="ai-gateway" element={<PrototypeModulePage type="ai-gateway" />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="automation" element={<AutomationPage />} />
        <Route path="chatbot" element={<ChatbotPage />} />
        <Route path="sandbox" element={<PrototypeModulePage type="sandbox" />} />
        <Route path="licenses" element={<PrototypeModulePage type="licenses" />} />
        <Route path="reports" element={<PrototypeModulePage type="reports" />} />
        <Route path="departments" element={<PrototypeModulePage type="departments" />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/system/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
