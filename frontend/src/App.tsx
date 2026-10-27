import { type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { HomeRedirect, RequireAuth, RequireRole } from './auth/guards'
import { ROLE_CONFIG, ROLE_SLUGS, type NavItem } from './config/navigation'
import { RoleShell } from './layouts/RoleShell'
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'
import LoginPage from './pages/LoginPage'
import RoleDashboard from './pages/RoleDashboard'
import NotFoundPage from './pages/shared/NotFoundPage'
import PlaceholderPage from './pages/shared/PlaceholderPage'
import ProfilePage from './pages/shared/ProfilePage'
import type { RoleSlug } from './types'

/** Menentukan halaman untuk setiap menu. Menu yang belum punya fitur memakai placeholder. */
function pageFor(role: RoleSlug, item: NavItem): ReactElement {
  if (item.path === '') return role === 'admin' ? <AdminDashboard /> : <RoleDashboard role={role} />
  if (role === 'admin' && item.key === 'users') return <UsersPage />
  if (item.key === 'profile') return <ProfilePage />
  return <PlaceholderPage title={item.label} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomeRedirect />} />

        {ROLE_SLUGS.map((role) => (
          <Route key={role} path={`/${role}`} element={<RequireRole role={role} />}>
            <Route element={<RoleShell role={role} />}>
              {ROLE_CONFIG[role].items.map((item) =>
                item.path === '' ? (
                  <Route key={item.key} index element={pageFor(role, item)} />
                ) : (
                  <Route key={item.key} path={item.path} element={pageFor(role, item)} />
                ),
              )}
              <Route path="*" element={<Navigate to={`/${role}`} replace />} />
            </Route>
          </Route>
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
