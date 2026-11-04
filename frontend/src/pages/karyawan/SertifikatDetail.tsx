import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState } from '../../components/ui/States'
import { BackLink } from './detailParts'
import { CERTIFICATES, formatLongDate } from './sertifikatData'

const LIST_PATH = '/karyawan/certificates'

/** Tampilan sertifikat (/karyawan/certificates/:certificateId). Nama penerima dari akun yang login. */
export default function KaryawanSertifikatDetail() {
  const { certificateId } = useParams()
  const { user } = useAuth()
  // Hanya sertifikat yang sudah disetujui Admin yang bisa dibuka.
  const certificate = CERTIFICATES.find((item) => String(item.id) === certificateId && item.status === 'disetujui')

  if (!certificate) {
    return (
      <>
        <BackLink to={LIST_PATH} />
        <div className="mt-6 rounded-3xl bg-white shadow-md">
          <EmptyState title="Sertifikat tidak ditemukan" description="Sertifikat yang Anda buka tidak tersedia." />
        </div>
      </>
    )
  }

  return (
    <>
      <BackLink to={LIST_PATH} />
      <article className="mx-auto mt-4 max-w-5xl rounded-2xl bg-white px-6 py-10 text-center shadow-lg sm:px-16 sm:py-14">
        <h1 className="font-serif text-5xl text-blue-600 sm:text-7xl">SERTIFIKAT</h1>
        <p className="mt-3 text-xl font-bold text-slate-600 sm:text-2xl">KELULUSAN</p>
        <p className="mt-3 text-lg font-light text-slate-500 sm:text-2xl">{certificate.number}</p>
        <p className="mt-3 text-lg text-slate-900 sm:text-2xl">Dengan bangga diberikan kepada:</p>
        <p className="mt-4 border-b border-indigo-500 pb-3 text-4xl font-bold text-blue-600 sm:text-6xl">{user?.name}</p>
        <p className="mt-4 text-lg text-slate-900 sm:text-xl">sebagai</p>
        <p className="mt-1 text-2xl font-bold text-slate-600 sm:text-3xl">PESERTA</p>
        <p className="mx-auto mt-6 max-w-3xl text-sm text-slate-900 sm:text-base">
          Dengan ini dinyatakan bahwa peserta telah berhasil menyelesaikan seluruh rangkaian pembelajaran dan proyek dalam {certificate.kind}{' '}
          <strong>{certificate.title}</strong> yang diselenggarakan oleh <strong>Maxy Academy</strong> pada{' '}
          <strong>{formatLongDate(certificate.heldAt)}.</strong> Program ini dirancang untuk membekali peserta dengan pengetahuan dan keterampilan
          dalam {certificate.skills}.
        </p>

        <div className="mt-8 flex flex-wrap justify-between gap-8">
          <Signatory name={certificate.issuer} role="LMS Maxy Academy" path="M4 50c30-10 90-18 118-26 14-5-30-22-54-8-16 10-22 34-8 36 12 2 8-44 16-46 12-4 30-6 44-8" />
          <Signatory name={certificate.mentor} role={`Mentor ${certificate.kind}`} path="M8 22c30-8 70-8 84 4 10 10-20 12-16 28 2 8 34-30 44-44 4-6-20-8-34-6M48 40c4-14 6-30 12-36 4 8 0 34 4 44" />
        </div>
      </article>
    </>
  )
}

/** Nama penanda tangan. Goresan tanda tangan hanya contoh; tanda tangan asli nanti berupa gambar. */
function Signatory({ name, role, path }: { name: string; role: string; path: string }) {
  return (
    <div className="mx-auto">
      <svg viewBox="0 0 136 56" className="mx-auto h-16 w-40 text-slate-900" aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-lg font-bold text-slate-600">{name}</p>
      <p className="mt-2 text-slate-500">{role}</p>
    </div>
  )
}
