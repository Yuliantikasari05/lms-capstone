import { useState } from 'react'
import { TERMS } from '../config/terms'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

/** Isi lengkap Syarat dan Ketentuan (tanpa judul). */
function TermsContent() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
      <p>{TERMS.intro}</p>
      {TERMS.sections.map((section) => (
        <div key={section.title}>
          <h3 className="font-semibold text-slate-800">{section.title}</h3>
          <p className="mt-0.5">{section.body}</p>
        </div>
      ))}
      <p>{TERMS.closing}</p>
    </div>
  )
}

/** Kotak S&K yang bisa digulir, untuk ditampilkan langsung di halaman. */
export function TermsBox() {
  return (
    <section>
      <h2 id="terms-title" className="text-sm font-semibold text-ink-900">
        {TERMS.title}
      </h2>
      <p className="text-xs text-slate-500">{TERMS.subtitle}</p>
      <div
        role="region"
        aria-labelledby="terms-title"
        tabIndex={0}
        className="mt-2 h-48 overflow-y-auto rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5"
      >
        <TermsContent />
      </div>
    </section>
  )
}

interface TermsCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** true = "Syarat dan Ketentuan" menjadi link yang membuka isi S&K dalam dialog. */
  linked?: boolean
}

/** Kotak centang persetujuan S&K. Pemanggil yang menonaktifkan tombol kirimnya selama belum dicentang. */
export function TermsCheckbox({ checked, onChange, linked = false }: TermsCheckboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-700">
      <input
        id="terms"
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-labelledby="terms-label terms-name"
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
      />
      <p>
        <label id="terms-label" htmlFor="terms">
          Saya telah membaca, memahami, dan menyetujui
        </label>{' '}
        {linked ? (
          // Di luar <label> agar membuka S&K tidak ikut mencentang kotaknya.
          <button id="terms-name" type="button" onClick={() => setOpen(true)} className="font-semibold text-brand-700 underline hover:text-brand-600">
            Syarat dan Ketentuan
          </button>
        ) : (
          <label id="terms-name" htmlFor="terms" className="font-semibold">
            Syarat dan Ketentuan
          </label>
        )}
        .
      </p>

      {linked && (
        <Modal
          open={open}
          title={TERMS.title}
          description={TERMS.subtitle}
          onClose={() => setOpen(false)}
          size="lg"
          footer={<Button onClick={() => setOpen(false)}>Tutup</Button>}
        >
          <TermsContent />
        </Modal>
      )}
    </div>
  )
}
