import { type FormEvent, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { api, toApiError } from '../../../lib/api'
import type { ApiMessage } from '../../../types'
import type { TemporaryPasswordInfo } from '../users/shared'
import type { CreateInstitutionResponse, Institution } from './types'

interface Props {
  institution?: Institution
  onClose: () => void
  onSaved: (message: string, password?: TemporaryPasswordInfo) => void
}

type FieldErrors = Record<string, string[]>

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'suspended', label: 'Ditangguhkan' },
] as const

export function InstitutionFormModal({ institution, onClose, onSaved }: Props) {
  const isEdit = !!institution
  const [name, setName] = useState(institution?.name ?? '')
  const [email, setEmail] = useState(institution?.email ?? '')
  const [description, setDescription] = useState(institution?.description ?? '')
  const [phone, setPhone] = useState(institution?.phone ?? '')
  const [address, setAddress] = useState(institution?.address ?? '')
  const [revenueShare, setRevenueShare] = useState(institution?.revenue_share_percent === null || institution?.revenue_share_percent === undefined ? '' : String(institution.revenue_share_percent))
  const [status, setStatus] = useState(institution?.status ?? 'active')
  const [bankName, setBankName] = useState(institution?.bank.name ?? '')
  const [accountHolder, setAccountHolder] = useState(institution?.bank.account_holder ?? '')
  const [accountNumber, setAccountNumber] = useState('')
  const [clearBank, setClearBank] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const firstError = (field: string) => errors[field]?.[0]
  const describedBy = (field: string, id: string) => (firstError(field) ? `${id}-help` : undefined)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setGeneral(null)

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedAccount = accountNumber.replace(/[\s-]+/g, '')
    const bankTouched = clearBank || !!bankName.trim() || !!accountHolder.trim() || !!normalizedAccount
    const local: FieldErrors = {}

    if (!name.trim()) local.name = ['Nama lembaga wajib diisi.']
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) local.email = ['Masukkan alamat email yang valid.']
    if (revenueShare !== '' && (!Number.isInteger(Number(revenueShare)) || Number(revenueShare) < 1 || Number(revenueShare) > 100)) {
      local.revenue_share_percent = ['Bagi hasil harus bilangan bulat antara 1 dan 100.']
    }
    if (!isEdit && revenueShare === '') local.revenue_share_percent = ['Persentase bagi hasil wajib diisi.']
    if (phone.trim() && !/^[0-9+()\-\s]{6,30}$/.test(phone.trim())) local.phone = ['Format nomor telepon tidak valid.']
    if (bankTouched && !clearBank) {
      if (!bankName.trim()) local.bank_name = ['Nama bank wajib diisi bila rekening diatur.']
      if (!accountHolder.trim()) local.bank_account_holder = ['Nama pemilik rekening wajib diisi bila rekening diatur.']
      if (!institution?.bank.configured && !normalizedAccount) local.bank_account_number = ['Nomor rekening wajib diisi.']
      if (normalizedAccount && !/^[0-9]{5,30}$/.test(normalizedAccount)) local.bank_account_number = ['Nomor rekening harus 5–30 digit.']
    }
    setErrors(local)
    if (Object.keys(local).length > 0) return

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: normalizedEmail,
      description: description.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      status,
    }
    if (revenueShare !== '') payload.revenue_share_percent = Number(revenueShare)

    if (clearBank) {
      payload.bank_name = null
      payload.bank_account_holder = null
      payload.bank_account_number = null
    } else if (bankTouched) {
      payload.bank_name = bankName.trim()
      payload.bank_account_holder = accountHolder.trim()
      if (normalizedAccount) payload.bank_account_number = normalizedAccount
    } else if (!isEdit) {
      payload.bank_name = null
      payload.bank_account_holder = null
      payload.bank_account_number = null
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        const response = await api.patch<ApiMessage<Institution>>(`/institutions/${institution.id}`, payload)
        onSaved(response.data.message ?? 'Lembaga berhasil diperbarui.')
      } else {
        const response = await api.post<CreateInstitutionResponse>('/institutions', payload)
        const password = response.data.temporary_password
          ? {
              name: response.data.data.name,
              email: response.data.data.email ?? normalizedEmail,
              password: response.data.temporary_password,
              reason: 'created' as const,
            }
          : undefined
        onSaved(response.data.message ?? 'Lembaga berhasil dibuat.', password)
      }
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'validation' && Object.keys(apiError.fieldErrors).length > 0) setErrors(apiError.fieldErrors)
      else setGeneral(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Ubah Lembaga' : 'Tambah Lembaga'}
      description={isEdit ? 'Ubah profil, status akun, bagi hasil, atau rekening.' : 'Akun lembaga dibuat otomatis dengan kata sandi sementara.'}
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="institution-form" loading={submitting}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Lembaga'}
          </Button>
        </>
      }
    >
      <form id="institution-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {general}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="institution-name" label="Nama lembaga" error={firstError('name')}>
            <input id="institution-name" data-autofocus value={name} onChange={(event) => setName(event.target.value)} maxLength={150} aria-invalid={!!firstError('name')} aria-describedby={describedBy('name', 'institution-name')} className={inputClass(!!firstError('name'))} />
          </Field>
          <Field id="institution-email" label="Email akun" error={firstError('email')} hint={isEdit ? 'Perubahan email akan dikirimkan ke email lama.' : 'Email untuk login lembaga.'}>
            <input id="institution-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} aria-invalid={!!firstError('email')} aria-describedby={describedBy('email', 'institution-email') ?? 'institution-email-help'} className={inputClass(!!firstError('email'))} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="institution-phone" label="Nomor telepon (opsional)" error={firstError('phone')}>
            <input id="institution-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} aria-invalid={!!firstError('phone')} aria-describedby={describedBy('phone', 'institution-phone')} className={inputClass(!!firstError('phone'))} />
          </Field>
          <Field id="institution-share" label="Bagi hasil lembaga (%)" error={firstError('revenue_share_percent')} hint="Bagian platform adalah sisa dari 100%.">
            <input id="institution-share" type="number" min={1} max={100} step={1} value={revenueShare} onChange={(event) => setRevenueShare(event.target.value)} aria-invalid={!!firstError('revenue_share_percent')} aria-describedby={describedBy('revenue_share_percent', 'institution-share') ?? 'institution-share-help'} className={inputClass(!!firstError('revenue_share_percent'))} />
          </Field>
        </div>

        <Field id="institution-description" label="Deskripsi (opsional)" error={firstError('description')}>
          <textarea id="institution-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={1000} aria-invalid={!!firstError('description')} aria-describedby={describedBy('description', 'institution-description')} className={inputClass(!!firstError('description'))} />
        </Field>

        <Field id="institution-address" label="Alamat (opsional)" error={firstError('address')}>
          <textarea id="institution-address" value={address} onChange={(event) => setAddress(event.target.value)} rows={2} maxLength={500} aria-invalid={!!firstError('address')} aria-describedby={describedBy('address', 'institution-address')} className={inputClass(!!firstError('address'))} />
        </Field>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ink-900">Rekening pencairan (opsional)</h3>
            <p className="mt-1 text-xs text-slate-500">
              {institution?.bank.configured
                ? `Rekening tersimpan: ${institution.bank.label}. Nomor rekening tidak dapat dibaca kembali; isi nomor baru hanya jika ingin menggantinya.`
                : 'Jika diisi, bank, nama pemilik, dan nomor rekening harus lengkap.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="institution-bank" label="Nama bank" error={firstError('bank_name')}>
              <input id="institution-bank" value={bankName} onChange={(event) => setBankName(event.target.value)} maxLength={50} disabled={clearBank} aria-invalid={!!firstError('bank_name')} aria-describedby={describedBy('bank_name', 'institution-bank')} className={inputClass(!!firstError('bank_name'))} />
            </Field>
            <Field id="institution-account-holder" label="Nama pemilik rekening" error={firstError('bank_account_holder')}>
              <input id="institution-account-holder" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} maxLength={100} disabled={clearBank} aria-invalid={!!firstError('bank_account_holder')} aria-describedby={describedBy('bank_account_holder', 'institution-account-holder')} className={inputClass(!!firstError('bank_account_holder'))} />
            </Field>
          </div>
          <div className="mt-4">
            <Field id="institution-account-number" label={institution?.bank.configured ? 'Nomor rekening baru (opsional)' : 'Nomor rekening'} error={firstError('bank_account_number')} hint={institution?.bank.configured ? 'Kosongkan untuk tetap memakai rekening yang tersimpan.' : '5–30 digit; spasi dan tanda hubung akan dihapus.'}>
              <input id="institution-account-number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} maxLength={36} disabled={clearBank} aria-invalid={!!firstError('bank_account_number')} aria-describedby={describedBy('bank_account_number', 'institution-account-number') ?? 'institution-account-number-help'} className={inputClass(!!firstError('bank_account_number'))} />
            </Field>
          </div>
          {isEdit && institution.bank.configured && (
            <label className="mt-3 flex items-start gap-2 text-sm text-red-700">
              <input type="checkbox" checked={clearBank} onChange={(event) => setClearBank(event.target.checked)} className="mt-0.5" />
              Kosongkan seluruh data rekening tersimpan
            </label>
          )}
        </div>

        <Field id="institution-status" label="Status akun" error={firstError('status')} hint="Status selain Aktif akan mengeluarkan sesi lembaga.">
          <select id="institution-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-invalid={!!firstError('status')} aria-describedby={describedBy('status', 'institution-status')} className={inputClass(!!firstError('status'))}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {!isEdit && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Kata sandi sementara akan ditampilkan satu kali setelah akun dibuat. Lembaga wajib menggantinya saat login pertama.
          </p>
        )}
      </form>
    </Modal>
  )
}
