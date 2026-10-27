import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="max-w-md text-center">
        <p className="text-5xl font-semibold text-slate-300">404</p>
        <h1 className="mt-3 text-xl font-semibold text-ink-900">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-500">Alamat yang Anda buka tidak tersedia.</p>
        <Link to="/" className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Ke beranda
        </Link>
      </div>
    </div>
  )
}
