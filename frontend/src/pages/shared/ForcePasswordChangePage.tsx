import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { ChangePasswordForm } from './ChangePasswordForm'

/**
 * Layar wajib-ganti kata sandi untuk akun yang kata sandinya dibuat/direset Admin.
 * Ditampilkan menggantikan seluruh aplikasi sampai kata sandi diganti (backend juga menolak endpoint lain).
 */
export default function ForcePasswordChangePage() {
  const { user, logout, retryBoot } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-lg bg-brand-50 p-2 text-brand-700" aria-hidden>
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Ganti kata sandi sementara</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user ? `Halo, ${user.name}. ` : ''}Kata sandi Anda dibuat oleh Administrator. Demi keamanan, buat kata sandi baru yang hanya Anda yang tahu sebelum melanjutkan.
            </p>
          </div>
        </div>

        <ChangePasswordForm onChanged={retryBoot} />

        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
          Akun ini dikelola oleh Administrator LMS untuk keperluan administrasi (membuat, menonaktifkan, atau mereset akun). Seluruh tindakan pengelolaan akun dicatat. Setelah Anda
          mengganti kata sandi, tidak seorang pun, termasuk Administrator, dapat mengetahuinya.
        </p>

        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => void logout()}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
