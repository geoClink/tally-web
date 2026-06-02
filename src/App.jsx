import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Sessions from './pages/Sessions'
import ClientRates from './pages/ClientRates'
import Team from './pages/Team'
import Billing from './pages/Billing'
import Invoices from './pages/Invoices'
import Track from './pages/Track'

// Think of this like the App struct in SwiftUI — it sets up the navigation stack
// and wraps everything in the shared context providers (like @EnvironmentObject).
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="track" element={<Track />} />
              <Route path="reports" element={<Reports />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="clients" element={<ClientRates />} />
              <Route path="team" element={<Team />} />
              <Route path="billing" element={<Billing />} />
              <Route path="invoices" element={<Invoices />} />
            </Route>
          </Routes>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
