// Like a conditional NavigationLink in SwiftUI — sends unauthenticated users to /login.
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Navigate to="/" replace />

  return children
}
