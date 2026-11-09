import { WorkspacePage } from '@/pages/WorkspacePage'
import { SchoolPortalPage } from '@/pages/SchoolPortalPage'
import { SchoolOperationsPage } from '@/pages/SchoolOperationsPage'
import { useAuthStore } from '@/store/auth.store'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/toaster'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { LeadsPage } from '@/pages/leads/LeadsPage'
import { LeadDetailPage } from '@/pages/leads/LeadDetailPage'
import { SchoolsPage } from '@/pages/schools/SchoolsPage'
import { SchoolDetailPage } from '@/pages/schools/SchoolDetailPage'
import { QuotationsPage } from '@/pages/QuotationsPage'
import { QuotationDetailPage } from '@/pages/QuotationDetailPage'
import { AgreementsPage } from '@/pages/AgreementsPage'
import { TasksPage } from '@/pages/TasksPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ActivityPage } from '@/pages/ActivityPage'

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.user?.role !== previous.user?.role) queryClient.clear()
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/portal" element={<SchoolPortalPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/schools" element={<SchoolsPage />} />
            <Route path="/schools/:id" element={<SchoolDetailPage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/quotations/:id" element={<QuotationDetailPage />} />
            <Route path="/agreements" element={<AgreementsPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/operations" element={<SchoolOperationsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
