import { ArrowLeft, Award, BookOpen, ClipboardList, Clock, CreditCard, Download, Eye, Lock, Play, PlusCircle, Star, User, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatRating, type CourseMaterial, type TrainingModule } from './pelatihanData'

/** Bagian yang dipakai bersama oleh halaman detail Pelatihan dan Webinar Karyawan. */

export function BackLink({ to, light = false }: { to: string; light?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-sm font-semibold ${light ? 'text-white/75 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Kembali
    </Link>
  )
}

interface CourseHeroProps {
  backTo: string
  label: string
  title: string
  tagline: string
  owner: string
  rating: number
  duration: string
  purchased: boolean
  certificateEligible: boolean
  price: number
}

/** Banner biru: panel kanan berisi pembayaran bila belum dibayar, atau Ajukan sertifikat bila sudah. */
export function CourseHero({ backTo, label, title, tagline, owner, rating, duration, purchased, certificateEligible, price }: CourseHeroProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-8 rounded-[2.5rem] bg-[#0085FF] px-6 py-10 text-white shadow-md sm:px-16">
      <div className="min-w-0">
        <BackLink to={backTo} light />
        <span className="mt-3 block w-fit rounded bg-white/40 px-4 py-0.5 text-[10px]">{label}</span>
        <h1 className="mt-3 text-4xl font-bold">{title}</h1>
        <p className="mt-3 max-w-xl text-2xl font-semibold text-white/75">{tagline}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-16 gap-y-2 font-semibold">
          <span className="flex items-center gap-3">
            <User className="h-5 w-5 fill-current" aria-hidden />
            {owner}
          </span>
          <span className="flex items-center gap-3">
            <Star className="h-5 w-5 fill-current" aria-hidden />
            {formatRating(rating)}/5,0
          </span>
          <span className="flex items-center gap-3">
            <Clock className="h-5 w-5" aria-hidden />
            {duration}
          </span>
        </div>
      </div>

      <div className="w-full rounded-3xl bg-blue-50 p-8 sm:w-80">
        {purchased ? (
          <>
            {/* Pengajuan ke Admin dihubungkan saat modul sertifikat dibuat. */}
            <button
              type="button"
              disabled={!certificateEligible}
              className="flex w-full items-center gap-5 rounded bg-white px-8 py-5 font-bold text-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <Award className="h-6 w-6 shrink-0" aria-hidden />
              Ajukan sertifikat
            </button>
            {!certificateEligible && <p className="mt-3 text-center text-xs text-slate-500">Syarat nilai dan kehadiran belum terpenuhi</p>}
          </>
        ) : (
          <>
            <p className="text-center text-sm text-slate-600">Bayar untuk membuka materi</p>
            <p className="mt-1 text-center text-2xl font-bold text-slate-900">Rp. {price.toLocaleString('id-ID')}</p>
            <Link
              to="/karyawan/payments"
              className="mt-4 flex w-full items-center justify-center gap-3 rounded bg-[#0085FF] px-8 py-4 font-bold text-white hover:bg-blue-600"
            >
              <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
              Bayar Sekarang
            </Link>
          </>
        )}
      </div>
    </section>
  )
}

export function ModuleRow({ module }: { module: TrainingModule }) {
  const locked = module.status === 'locked'

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 px-6 py-4 sm:px-8">
      {locked ? (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Lock className="h-7 w-7" aria-label="Terkunci" />
        </span>
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-200">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0085FF] text-white">
            <Play className="h-4 w-4 fill-current" aria-hidden />
          </span>
        </span>
      )}

      <div className="min-w-[12rem] flex-1">
        <p className={`text-xl font-semibold ${locked ? 'text-slate-400' : 'text-slate-900'}`}>{module.title}</p>
        <p className="mt-1 flex items-center gap-3 text-sm text-slate-500">
          <Video className="h-5 w-5 fill-current text-slate-400" aria-hidden />
          <span>Video</span>
          <span className="ml-14">{module.durationMinutes} menit</span>
        </p>
      </div>

      {/* Tombol belum terhubung ke halaman materi. */}
      {module.status === 'done' && (
        <button type="button" className="flex items-center gap-2 rounded-lg border border-violet-300 px-3 py-0.5 text-sm font-semibold text-violet-500 hover:bg-violet-50">
          <Eye className="h-4 w-4" aria-hidden />
          Lihat
        </button>
      )}
      {module.status === 'current' && (
        <button type="button" className="rounded-lg bg-[#0085FF] px-5 py-0.5 text-sm font-semibold text-white hover:bg-blue-600">
          Mulai
        </button>
      )}
      {locked && (
        <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-300 px-5 py-0.5 text-sm font-semibold text-slate-600">
          Mulai
        </button>
      )}
    </li>
  )
}

export function ModuleStats({ total }: { total: number }) {
  return (
    <section className="h-fit rounded-2xl border border-slate-300 bg-white px-8 pb-24 pt-6">
      <h2 className="text-2xl font-semibold text-slate-900">Statistik</h2>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3">
        <BookOpen className="h-5 w-5 text-blue-600" aria-hidden />
        <span className="flex-1 text-slate-800">Total modul</span>
        <span className="font-bold text-slate-900">{total}</span>
      </div>
    </section>
  )
}

export function MaterialRow({ material, locked }: { material: CourseMaterial; locked: boolean }) {
  return (
    <li className="flex items-center gap-6 rounded-2xl border border-slate-300 bg-white px-5 py-3.5">
      <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <ClipboardList className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-semibold text-slate-900">{material.name}</p>
        <p className="mt-1 text-sm text-slate-500">PDF {material.sizeMb.toLocaleString('id-ID')} MB</p>
      </div>
      {locked ? (
        <span className="p-2 text-slate-400" title="Bayar untuk mengunduh">
          <Lock className="h-6 w-6" aria-label="Terkunci" />
        </span>
      ) : (
        // Unduhan file belum terhubung ke backend.
        <button type="button" className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label={`Unduh ${material.name}`}>
          <Download className="h-6 w-6" aria-hidden />
        </button>
      )}
    </li>
  )
}

/** Tombol membuat pertanyaan; dihubungkan saat forum diskusi dibuat. */
export function AskQuestionButton({ className = '' }: { className?: string }) {
  return (
    <button type="button" className={`flex items-center gap-3 font-bold text-[#0085FF] hover:underline ${className}`}>
      <PlusCircle className="h-6 w-6 fill-[#0085FF] text-white" aria-hidden />
      Buat Pertanyaan
    </button>
  )
}
