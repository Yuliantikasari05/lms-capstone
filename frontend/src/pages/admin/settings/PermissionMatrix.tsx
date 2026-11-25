import { LockKeyhole, Search } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { inputClass } from '../../../components/ui/Field'
import type { Action, MatrixActivity, MatrixCell, MatrixModule } from './types'

const ACTIONS: { key: Action; label: string }[] = [
  { key: 'create', label: 'Tambah' },
  { key: 'read', label: 'Lihat' },
  { key: 'update', label: 'Ubah' },
  { key: 'delete', label: 'Hapus' },
]
const ACTION_LABEL = Object.fromEntries(ACTIONS.map(({ key, label }) => [key, label])) as Record<Action, string>

/** Perubahan yang diminta: daftar slug, dinyalakan/dimatikan, dan nama izin sensitif yang baru akan menyala. */
export interface PermissionChange {
  slugs: string[]
  on: boolean
  sensitive: string[]
}

interface PermissionMatrixProps {
  /** Pembeda id bila dua matriks tampil bersamaan (halaman dan dialog). */
  id: string
  modules: MatrixModule[]
  selected: string[]
  readOnly: boolean
  onChange: (change: PermissionChange) => void
}

/** Matriks izin per aktivitas. Status sakelar mengikuti slug, sehingga sel dengan izin yang sama bergerak bersama. */
export function PermissionMatrix({ id, modules, selected, readOnly, onChange }: PermissionMatrixProps) {
  const [query, setQuery] = useState('')
  const selectedSet = new Set(selected)
  const keyword = query.trim().toLowerCase()

  const matches = (activity: MatrixActivity) =>
    [activity.label, activity.description, ...activity.cells.map((cell) => cell.slug ?? '')].some((text) => text.toLowerCase().includes(keyword))

  const visible = modules
    .map((module) => ({ ...module, activities: module.activities.filter(matches) }))
    .filter((module) => module.activities.length > 0)

  const request = (items: { activity: MatrixActivity; cell: MatrixCell }[], on: boolean) => {
    const slugs = [...new Set(items.flatMap(({ cell }) => (cell.slug ? [cell.slug] : [])))]
    const sensitive = on
      ? items
          .filter(({ cell }) => cell.sensitive && cell.slug && !selectedSet.has(cell.slug))
          .map(({ activity, cell }) => `${ACTION_LABEL[cell.action]}: ${activity.label}`)
      : []
    onChange({ slugs, on, sensitive })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari izin"
          aria-label="Cari izin"
          className={`${inputClass()} pl-9`}
        />
      </div>

      {visible.length === 0 && <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Tidak ada izin yang cocok.</p>}

      {visible.map((module) => {
        const editable = module.activities.flatMap((activity) => activity.cells.filter((cell) => cell.editable).map((cell) => ({ activity, cell })))
        const slugs = [...new Set(editable.flatMap(({ cell }) => (cell.slug ? [cell.slug] : [])))]
        const active = slugs.filter((slug) => selectedSet.has(slug)).length
        const allOn = slugs.length > 0 && active === slugs.length
        const headingId = `${id}-${module.key}`

        return (
          <section key={module.key} aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-slate-200">
            <header className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <h3 id={headingId} className="text-sm font-semibold text-ink-900">
                {module.name}
              </h3>
              {/* Disembunyikan saat mencari agar tidak mengubah baris yang sedang tidak tampil. */}
              {slugs.length > 0 && !keyword && (
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {active}/{slugs.length} aktif
                  </span>
                  <span className="flex items-center gap-2">
                    Semua
                    <Switch checked={allOn} disabled={readOnly} label={`Semua izin ${module.name}`} onClick={() => request(editable, !allOn)} />
                  </span>
                </div>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-y border-slate-100">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Aktivitas
                    </th>
                    {ACTIONS.map(({ key, label }) => (
                      <th key={key} scope="col" className="w-20 px-2 py-2 text-center font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {module.activities.map((activity) => (
                    <tr key={activity.key}>
                      <th scope="row" className="px-4 py-3 font-normal">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-800">{activity.label}</span>
                          {activity.status === 'planned' && <Badge tone="neutral">Belum tersedia</Badge>}
                          {activity.scope === 'own' && <Badge tone="info">Hanya data milik sendiri</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{activity.description}</span>
                      </th>
                      {ACTIONS.map(({ key }) => {
                        const cell = activity.cells.find((item) => item.action === key)
                        return (
                          <td key={key} className="px-2 py-3 text-center align-middle">
                            {cell && (
                              <CellSwitch
                                cell={cell}
                                label={`${ACTION_LABEL[key]}: ${activity.label}`}
                                checked={cell.slug !== null && selectedSet.has(cell.slug)}
                                readOnly={readOnly}
                                onToggle={(on) => request([{ activity, cell }], on)}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      <p className="text-xs text-slate-500">Beberapa sakelar memakai izin yang sama, sehingga ikut berubah bersama.</p>
    </div>
  )
}

interface CellSwitchProps {
  cell: MatrixCell
  label: string
  checked: boolean
  readOnly: boolean
  onToggle: (on: boolean) => void
}

function CellSwitch({ cell, label, checked, readOnly, onToggle }: CellSwitchProps) {
  if (cell.state === 'na') return null

  return (
    <span className="inline-flex items-center gap-1" title={cell.reason ?? undefined}>
      <Switch
        checked={checked || cell.state === 'locked'}
        disabled={readOnly || !cell.editable}
        label={cell.reason ? `${label}. ${cell.reason}` : label}
        onClick={() => onToggle(!checked)}
      />
      {cell.state === 'locked' && <LockKeyhole className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
    </span>
  )
}

function Switch({ checked, disabled, label, onClick }: { checked: boolean; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} aria-hidden />
    </button>
  )
}
