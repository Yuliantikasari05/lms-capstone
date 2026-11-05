export type CertificateStatus = 'menunggu' | 'ditolak' | 'disetujui'

export interface Certificate {
  id: number
  status: CertificateStatus
  title: string
  description: string
  kind: 'Pelatihan' | 'Webinar'
  /** Tanggal Karyawan mengajukan sertifikat. */
  submittedAt: string
  /** Tanggal program diselenggarakan. */
  heldAt: string
  /** Lanjutan kalimat "membekali peserta dengan pengetahuan dan keterampilan dalam ...". */
  skills: string
  mentor: string
  issuer: string
  /** Nomor sertifikat, ada setelah disetujui. */
  number?: string
  /** Tanggal terbit, ada setelah Admin menyetujui. */
  issuedAt?: string
  /** Alasan dari Admin, ada bila ditolak. */
  rejectedReason?: string
  /** Syarat nilai dan kehadiran terpenuhi; tombol Ajukan Ulang baru aktif bila true. Nanti dihitung backend. */
  canResubmit?: boolean
}

/*
 * DATA CONTOH (statis): pengajuan dan sertifikat Karyawan. Endpoint sertifikat belum ada.
 * Saat API tersedia, ganti CERTIFICATES dengan data dari backend dengan bentuk yang sama.
 */
export const CERTIFICATES: Certificate[] = [
  {
    id: 1,
    status: 'disetujui',
    number: 'NO. 30/LMS-TEST/CA-1298/2026',
    title: 'Advanced Data Security',
    description: 'Keamanan data dan tata kelola informasi.',
    kind: 'Webinar',
    submittedAt: '2026-10-19',
    issuedAt: '2026-10-21',
    heldAt: '2026-10-18',
    skills:
      'keamanan data, tata kelola informasi, identifikasi kerentanan, mitigasi risiko, serta implementasi standar keamanan digital yang relevan dengan kebutuhan industri',
    mentor: 'Yuli Antika Sari',
    issuer: 'Fulan bin Fulan',
  },
  {
    id: 2,
    status: 'disetujui',
    number: 'NO. 29/LMS-TEST/CA-1297/2026',
    title: 'Komunikasi Efektif',
    description: 'Berkomunikasi dengan jelas di lingkungan kerja.',
    kind: 'Pelatihan',
    submittedAt: '2026-10-10',
    issuedAt: '2026-10-12',
    heldAt: '2026-10-09',
    skills: 'komunikasi kerja, penyampaian gagasan, serta kerja sama tim yang relevan dengan kebutuhan industri',
    mentor: 'Prabiwo',
    issuer: 'Fulan bin Fulan',
  },
  {
    id: 3,
    status: 'menunggu',
    title: 'Manajemen Waktu',
    description: 'Mengatur prioritas dan waktu kerja.',
    kind: 'Pelatihan',
    submittedAt: '2026-11-03',
    heldAt: '2026-10-30',
    skills: 'pengaturan prioritas dan waktu kerja',
    mentor: 'Prabiwo',
    issuer: 'Fulan bin Fulan',
  },
  {
    id: 4,
    status: 'ditolak',
    title: 'Dasar Keuangan Perusahaan',
    description: 'Memahami laporan keuangan dasar.',
    kind: 'Webinar',
    submittedAt: '2026-10-28',
    heldAt: '2026-10-25',
    skills: 'laporan keuangan dasar',
    mentor: 'Prabiwo',
    issuer: 'Fulan bin Fulan',
    rejectedReason: 'Data kehadiran belum lengkap.',
    canResubmit: false,
  },
  {
    id: 5,
    status: 'ditolak',
    title: 'Etika Kerja',
    description: 'Menerapkan etika di lingkungan kerja.',
    kind: 'Pelatihan',
    submittedAt: '2026-10-22',
    heldAt: '2026-10-20',
    skills: 'etika kerja',
    mentor: 'Prabiwo',
    issuer: 'Fulan bin Fulan',
    rejectedReason: 'Nilai evaluasi sudah diperbaiki, silakan ajukan kembali.',
    canResubmit: true,
  },
]

const longDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/** Contoh: "2026-10-21" → "21 Oktober 2026". */
export function formatLongDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00`))
}
