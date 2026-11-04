import { type ComponentType, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { HomeRedirect, RequireAuth, RequireRole } from './auth/guards'
import { ROLE_CONFIG, ROLE_SLUGS, type ExtraRoute, type NavItem } from './config/navigation'
import { RoleShell } from './layouts/RoleShell'
import { adminPages, adminRoutes } from './pages/admin'
import { karyawanPages, karyawanRoutes } from './pages/karyawan'
import { lembagaPages } from './pages/lembaga'
import LoginPage from './pages/LoginPage'
import { mentorPages } from './pages/mentor'
import NotFoundPage from './pages/shared/NotFoundPage'
import PlaceholderPage from './pages/shared/PlaceholderPage'
import { siswaPages, siswaRoutes } from './pages/siswa'
import type { RoleSlug } from './types'

/** Halaman setiap role ada di folder pages/<role>/, didaftarkan di index.ts folder itu. */
const ROLE_PAGES: Record<RoleSlug, Record<string, ComponentType>> = {
  admin: adminPages,
  mentor: mentorPages,
  siswa: siswaPages,
  karyawan: karyawanPages,
  lembaga: lembagaPages,
}

/** Halaman di luar menu (misalnya detail), didaftarkan di index.ts folder role. */
const ROLE_EXTRA_ROUTES: Partial<Record<RoleSlug, ExtraRoute[]>> = {
  admin: adminRoutes,
  siswa: siswaRoutes,
  karyawan: karyawanRoutes,
}

/** Menentukan halaman untuk setiap menu. Menu yang belum didaftarkan memakai placeholder. */
function pageFor(role: RoleSlug, item: NavItem): ReactElement {
  const Page = ROLE_PAGES[role][item.key]
  return Page ? <Page /> : <PlaceholderPage title={item.label} />
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
                  <Route key={item.key} path={item.nested ? `${item.path}/*` : item.path} element={pageFor(role, item)} />
                ),
              )}
              {ROLE_EXTRA_ROUTES[role]?.map(({ path, Page }) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
              <Route path="*" element={<Navigate to={`/${role}`} replace />} />
            </Route>
          </Route>
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
