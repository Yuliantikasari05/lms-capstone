import { useState } from 'react'

export interface StudyMonth {
  date: Date
  hours: number
}

const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** Grafik garis jam belajar per bulan, dengan tooltip saat titik disorot. */
export function StudyChart({ months, yMax = 60 }: { months: StudyMonth[]; yMax?: number }) {
  const [range, setRange] = useState(6)
  const [hover, setHover] = useState<number | null>(null)
  const data = months.slice(-range)

  const W = 860
  const H = 230
  const left = 44
  const right = 24
  const top = 28
  const bottom = 28
  const max = Math.max(yMax, Math.ceil((Math.max(...data.map((item) => item.hours)) * 1.2) / 10) * 10)
  const ticks = Array.from({ length: max / 10 + 1 }, (_, index) => index * 10)
  const step = (W - left - right) / data.length
  const x = (index: number) => left + step * (index + 0.5)
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  const line = data.map((item, index) => `${index ? 'L' : 'M'}${x(index)} ${y(item.hours)}`).join('')
  const area = `${line}L${x(data.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`
  const hovered = hover === null ? null : data[hover]

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Grafik Perkembangan Belajar</h2>
        <select
          value={range}
          onChange={(event) => setRange(Number(event.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          aria-label="Rentang grafik"
        >
          <option value={3}>3 Bulan Terakhir</option>
          <option value={6}>6 Bulan Terakhir</option>
          <option value={12}>12 Bulan Terakhir</option>
        </select>
      </div>

      <div className="relative mt-2" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik jam belajar per bulan">
          <defs>
            <linearGradient id="study-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <text x={left - 34} y={12} className="fill-slate-600 text-[10px]">
            Jam Belajar
          </text>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'stroke-slate-300' : 'stroke-slate-100'} />
              <text x={left - 12} y={y(tick) + 3} textAnchor="end" className="fill-slate-500 text-[10px]">
                {tick}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#study-area)" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={y(0)} className="stroke-slate-300" strokeDasharray="4 4" />}
          <path d={line} fill="none" className="stroke-blue-600" strokeWidth={2} strokeLinejoin="round" />
          {data.map((item, index) => (
            <g key={item.date.toISOString()}>
              <circle cx={x(index)} cy={y(item.hours)} r={hover === index ? 5 : 3.5} className="fill-blue-600 stroke-white" strokeWidth={1.5} />
              <text x={x(index)} y={y(item.hours) - 10} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                {item.hours}
              </text>
              <text x={x(index)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {monthShort.format(item.date)}
              </text>
              <rect
                x={x(index) - step / 2}
                y={top}
                width={step}
                height={H - top - bottom}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${((y(hovered.hours) - 18) / H) * 100}%` }}
          >
            <p className="font-semibold">{monthYear.format(hovered.date)}</p>
            <p>{hovered.hours} jam belajar</p>
          </div>
        )}

        <table className="sr-only">
          <caption>Jam belajar per bulan</caption>
          <tbody>
            {data.map((item) => (
              <tr key={item.date.toISOString()}>
                <th scope="row">{monthYear.format(item.date)}</th>
                <td>{item.hours} jam</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
