import { Check, Copy, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import type { TemporaryPasswordInfo } from './shared'

/**
 * Menampilkan kata sandi sementara SATU KALI. Tidak bisa ditutup tanpa menegaskan bahwa kata sandi
 * sudah disimpan/disampaikan, karena server tidak menyimpan versi yang terbaca.
 */
export function TemporaryPasswordModal({ info, onClose }: { info: TemporaryPasswordInfo; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard bisa diblokir browser; kata sandi tetap bisa disalin manual dari kotak di atas.
    }
  }

  return (
    <Modal
      open
      title={info.reason === 'created' ? 'Akun berhasil dibuat' : 'Kata sandi berhasil direset'}
      description={`${info.name} (${info.email})`}
      onClose={onClose}
      dismissible={false}
      footer={
        <Button onClick={onClose} disabled={!confirmed}>
          Selesai
        </Button>
      }
    >
      <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Kata sandi sementara ini hanya ditampilkan sekali dan tidak dapat dilihat lagi setelah jendela ini ditutup.</p>
      </div>

      <p className="mb-1 text-sm font-medium text-slate-700">Kata sandi sementara</p>
      <div className="flex gap-2">
        <output data-testid="temporary-password" className="block flex-1 select-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-base tracking-wide text-ink-900">
          {info.password}
        </output>
        <Button variant="secondary" onClick={copy} icon={copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}>
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>

      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        <li>Sampaikan kepada pemilik akun lewat saluran yang aman (tatap muka atau pesan pribadi), jangan lewat grup.</li>
        <li>Pemilik akun wajib menggantinya saat login pertama. Sebelum itu, akunnya hanya bisa dipakai untuk mengganti kata sandi.</li>
        <li>Setelah diganti, tidak seorang pun, termasuk Admin, dapat mengetahui kata sandinya.</li>
        <li>Tindakan ini tercatat di riwayat aktivitas (tanpa menyimpan kata sandinya).</li>
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span>Saya sudah menyalin atau menyampaikan kata sandi ini kepada pemilik akun.</span>
      </label>
    </Modal>
  )
}
