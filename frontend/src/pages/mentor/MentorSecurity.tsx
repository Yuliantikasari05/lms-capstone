import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChangePasswordForm } from '../shared/ChangePasswordForm'

export default function MentorSecurity() {
  return (
    <div className="space-y-5">
      <Link to="/mentor/profile" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden />Kembali ke profil
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-900">Pengaturan keamanan</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Perbarui kata sandi dan jaga keamanan akun Anda.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-700">
            <LockKeyhole className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Ubah kata sandi</h2>
            <p className="mt-1 text-sm text-slate-500">Gunakan kata sandi yang kuat dan berbeda dari kata sandi sebelumnya.</p>
          </div>
        </div>
        <div className="max-w-3xl">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  )
}
