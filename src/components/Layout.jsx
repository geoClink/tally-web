// Like a SwiftUI NavigationSplitView — sidebar on the left, content on the right.
// <Outlet /> is where the current page renders (like the detail view in a split view).
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <nav className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </nav>
      <div className="main-content">
        <button
          className="menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <Outlet />
      </div>
    </div>
  )
}
