import { ArrowLeft, ArrowRight, CalendarDays, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CERTIFICATES, formatLongDate, type CertificateStatus } from './sertifikatData'

const STATUS: Record<CertificateStatus, { label: string; className: string }> = {
  disetujui: { label: 'Disetujui', className: 'bg-emerald-100 text-emerald-700' },
  menunggu: { label: 'Menunggu Review', className: 'bg-amber-100 text-amber-700' },
  ditolak: { label: 'Ditolak', className: 'bg-red-100 text-red-700' },
}

export default function KaryawanSertifikat() {
  return (
    <>
      <Link to="/karyawan" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali
      </Link>
      <h1 className="mt-10 text-4xl font-extrabold text-slate-800">Certificate &amp; Achievement</h1>

      {CERTIFICATES.length === 0 ? (
        <p className="mt-16 rounded-3xl bg-white px-6 py-12 text-center text-slate-500 shadow-md">Belum ada sertifikat.</p>
      ) : (
        <ul className="mt-16 grid gap-10 md:grid-cols-2 xl:gap-x-20">
          {CERTIFICATES.map((certificate) => {
            const status = STATUS[certificate.status]
            const approved = certificate.status === 'disetujui'
            return (
              <li key={certificate.id} className="rounded-3xl bg-white px-8 py-10 shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 text-3xl font-extrabold text-slate-800">{certificate.title}</h2>
                  <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-1 text-xl italic text-slate-500">{certificate.description}</p>
                <p className="mt-2 flex items-center gap-3 italic text-slate-500">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                  {approved && certificate.issuedAt
                    ? `Issued: ${formatLongDate(certificate.issuedAt)}`
                    : `Diajukan: ${formatLongDate(certificate.submittedAt)}`}
                </p>
                {certificate.rejectedReason && <p className="mt-2 text-sm text-red-600">Alasan: {certificate.rejectedReason}</p>}
                {certificate.status === 'ditolak' && (
                  <>
                    {/* Pengajuan ulang ke Admin dihubungkan saat modul sertifikat dibuat. */}
                    <button
                      type="button"
                      disabled={!certificate.canResubmit}
                      className="mt-4 rounded-lg border border-orange-400 px-6 py-2 font-bold text-orange-500 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      Ajukan Ulang
                    </button>
                    {!certificate.canResubmit && <p className="mt-2 text-xs text-slate-500">Syarat nilai dan kehadiran belum terpenuhi</p>}
                  </>
                )}
                {approved && (
                  <>
                    <Link
                      to={`/karyawan/certificates/${certificate.id}`}
                      className="mt-2 flex w-fit items-center gap-1 text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Lihat detail sertifikat
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    {/* Unduhan file sertifikat dihubungkan saat modul sertifikat dibuat. */}
                    <button type="button" className="mt-2 flex items-center gap-3 text-slate-600 hover:text-slate-900">
                      Unduh
                      <Download className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
