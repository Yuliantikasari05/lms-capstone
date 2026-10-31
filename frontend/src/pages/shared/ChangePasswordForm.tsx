import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Notice } from '../../components/ui/Notice'
import { api, toApiError } from '../../lib/api'

type FieldErrors = Record<string, string[]>

/** Form ganti kata sandi milik sendiri (POST /auth/password). Dipakai di halaman Profil dan layar wajib-ganti. */
export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string) => (firstError(field) ? `${field}-help` : undefined)
  const type = show ? 'text' : 'password'

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)
    setDone(false)

    const local: FieldErrors = {}
    if (!current) local.current_password = ['Kata sandi saat ini wajib diisi.']
    if (!next) local.password = ['Kata sandi baru wajib diisi.']
    else if (next !== confirm) local.password_confirmation = ['Konfirmasi kata sandi tidak cocok.']
    setErrors(local)
    if (Object.keys(local).length > 0) return

    setSubmitting(true)
    try {
      await api.post('/auth/password', { current_password: current, password: next, password_confirmation: confirm })
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
      onChanged?.()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setErrors(apiError.fieldErrors)
      else setGeneral(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {done && <Notice tone="success">Kata sandi berhasil diganti. Perangkat lain telah dikeluarkan.</Notice>}
      {general && <Notice tone="error">{general}</Notice>}

      <Field id="current_password" label="Kata sandi saat ini" error={firstError('current_password')}>
        <input
          id="current_password"
          type={type}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          data-autofocus
          aria-invalid={!!firstError('current_password')}
          aria-describedby={describedBy('current_password')}
          className={inputClass(!!firstError('current_password'))}
        />
      </Field>

      <Field id="password" label="Kata sandi baru" error={firstError('password')} hint="Minimal 12 karakter, ada huruf dan angka, dan berbeda dari kata sandi saat ini.">
        <input
          id="password"
          type={type}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          aria-invalid={!!firstError('password')}
          aria-describedby="password-help"
          className={inputClass(!!firstError('password'))}
        />
      </Field>

      <Field id="password_confirmation" label="Ulangi kata sandi baru" error={firstError('password_confirmation')}>
        <input
          id="password_confirmation"
          type={type}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={!!firstError('password_confirmation')}
          aria-describedby={describedBy('password_confirmation')}
          className={inputClass(!!firstError('password_confirmation'))}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setShow((v) => !v)} icon={show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}>
          {show ? 'Sembunyikan' : 'Tampilkan'} kata sandi
        </Button>
        <Button type="submit" loading={submitting}>
          Ganti Kata Sandi
        </Button>
      </div>
    </form>
  )
}
