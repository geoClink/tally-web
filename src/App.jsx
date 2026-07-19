import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Sessions from './pages/Sessions'
import ClientRates from './pages/ClientRates'
import Team from './pages/Team'
import Billing from './pages/Billing'
import Invoices from './pages/Invoices'
import Track from './pages/Track'
import Settings from './pages/Settings'
import TeamDashboard from './pages/TeamDashboard'
import Calendar from './pages/Calendar'
import Demo from './pages/Demo'
import Privacy from './pages/Privacy'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/track" element={<Track />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/clients" element={<ClientRates />} />
              <Route path="/team" element={<Team />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/team-dashboard" element={<TeamDashboard />} />
              <Route path="/calendar" element={<Calendar />} />
            </Route>
          </Routes>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
