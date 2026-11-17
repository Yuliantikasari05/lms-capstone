import { Field, inputClass } from '../../components/ui/Field'
import { SESSION_TYPES, type SessionScheduleDetails } from './sessionData'

export function SessionScheduleFields({
  value,
  onChange,
}: {
  value: SessionScheduleDetails
  onChange: (value: SessionScheduleDetails) => void
}) {
  const setField = <K extends keyof SessionScheduleDetails>(key: K, fieldValue: SessionScheduleDetails[K]) => {
    onChange({ ...value, [key]: fieldValue })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="session-date" label="Tanggal">
          <input id="session-date" type="date" value={value.date} onChange={(event) => setField('date', event.target.value)} className={inputClass()} required />
        </Field>
        <Field id="session-start" label="Mulai">
          <input id="session-start" type="time" value={value.startTime} onChange={(event) => setField('startTime', event.target.value)} className={inputClass()} required />
        </Field>
        <Field id="session-end" label="Selesai">
          <input id="session-end" type="time" value={value.endTime} onChange={(event) => setField('endTime', event.target.value)} className={inputClass()} required />
        </Field>
      </div>

      <Field id="session-type" label="Tipe sesi">
        <select id="session-type" value={value.type} onChange={(event) => setField('type', event.target.value as SessionScheduleDetails['type'])} className={inputClass()} required>
          {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Metode bimbingan</legend>
        <div className="flex flex-wrap gap-5">
          {(['Online', 'Offline'] as const).map((mode) => (
            <label key={mode} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="session-mode"
                value={mode}
                checked={value.mode === mode}
                onChange={() => setField('mode', mode)}
                className="h-4 w-4 accent-brand-600"
              />
              {mode}
            </label>
          ))}
        </div>
      </fieldset>

      {value.mode === 'Offline' ? (
        <Field id="session-location" label="Lokasi (opsional)">
          <input id="session-location" value={value.location} onChange={(event) => setField('location', event.target.value)} className={inputClass()} placeholder="Contoh: Ruang bimbingan 1" />
        </Field>
      ) : (
        <Field id="session-meeting-link" label="Meeting link (opsional)">
          <input id="session-meeting-link" type="url" value={value.meetingLink} onChange={(event) => setField('meetingLink', event.target.value)} className={inputClass()} placeholder="https://meet.google.com/..." />
        </Field>
      )}
    </div>
  )
}
