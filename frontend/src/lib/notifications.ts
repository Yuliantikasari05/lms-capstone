import { useEffect, useSyncExternalStore } from 'react'
import { api, toApiError, type ApiError } from './api'

/**
 * Notifikasi dalam aplikasi (lonceng header dan halaman Notifikasi).
 *
 * Data berasal dari API `/notifications` milik pengguna yang login. Store menyimpan PEMILIK data
 * (`userId`), sehingga daftar milik akun sebelumnya tidak pernah tampil saat akun lain login di tab
 * yang sama: pembacaan selalu mencocokkan `userId` dengan pengguna aktif, dan permintaan lama yang
 * selesai setelah akun berganti diabaikan.
 */

export type NotificationCategory =
  | 'assessment'
  | 'schedule'
  | 'achievement'
  | 'system'
  | 'submission'
  | 'roster'
  | 'discussion'

export interface AppNotification {
  id: string
  category: NotificationCategory
  title: string
  message: string
  actor_name: string
  actor_role: string
  action_label: string | null
  href: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

interface NotificationState {
  userId: number | null
  items: AppNotification[]
  loading: boolean
  loaded: boolean
  error: ApiError | null
}

interface NotificationListResponse {
  data: AppNotification[]
  meta: { unread_count: number }
}

const EMPTY_STATE: NotificationState = { userId: null, items: [], loading: false, loaded: false, error: null }

let state: NotificationState = EMPTY_STATE
let inflight: Promise<void> | null = null
/** Dinaikkan setiap kali pemilik data berubah agar respons lama tidak menimpa data akun baru. */
let token = 0
const listeners = new Set<() => void>()

export function getNotificationState(): NotificationState {
  return state
}

export function subscribeNotifications(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(patch: Partial<NotificationState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

/** Buang data pemilik lama seketika, lalu mulai memuat data pemilik baru. */
function switchOwner(userId: number) {
  token += 1
  inflight = null
  state = { userId, items: [], loading: true, loaded: false, error: null }
  listeners.forEach((listener) => listener())
}

/** Memuat notifikasi milik pengguna yang sedang login; dimuat ulang bila pengguna berganti. */
export async function loadNotifications(userId: number | null, force = false): Promise<void> {
  if (userId === null) return
  if (state.userId !== userId) switchOwner(userId)
  if (inflight) return inflight
  if (!force && state.loaded) return

  const requestToken = ++token
  emit({ loading: true, error: null })

  const request = api
    .get<NotificationListResponse>('/notifications')
    .then((response) => {
      if (requestToken !== token || state.userId !== userId) return
      emit({ items: response.data.data, loading: false, loaded: true, error: null })
    })
    .catch((error: unknown) => {
      if (requestToken !== token || state.userId !== userId) return
      emit({ loading: false, loaded: false, error: toApiError(error) })
    })
    .finally(() => {
      if (requestToken === token) inflight = null
    })

  inflight = request
  return request
}

/**
 * State notifikasi yang aman untuk ditampilkan: kosong (dan berstatus memuat) selama store masih
 * berisi data akun lain, sehingga tidak ada satu frame pun yang menampilkan notifikasi orang lain.
 */
export function useNotifications(userId: number | null): NotificationState {
  const snapshot = useSyncExternalStore(subscribeNotifications, getNotificationState)

  useEffect(() => {
    void loadNotifications(userId)
  }, [userId])

  if (userId === null) return EMPTY_STATE
  if (snapshot.userId !== userId) return { ...EMPTY_STATE, userId, loading: true }
  return snapshot
}

/** Jalankan perubahan setelah request berhasil, hanya bila data masih milik akun yang sama. */
async function mutate(owner: number | null, request: Promise<unknown>, apply: () => Partial<NotificationState>) {
  try {
    await request
    if (owner === null || state.userId === owner) emit(apply())
  } catch (error) {
    if (owner === null || state.userId === owner) emit({ error: toApiError(error) })
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const owner = state.userId
  const current = state.items.find((item) => item.id === id)
  if (!current || current.is_read) return

  await mutate(owner, api.patch(`/notifications/${id}/read`), () => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item,
    ),
  }))
}

export async function markAllNotificationsRead(): Promise<void> {
  const owner = state.userId
  await mutate(owner, api.post('/notifications/read-all'), () => ({
    items: state.items.map((item) => ({
      ...item,
      is_read: true,
      read_at: item.read_at ?? new Date().toISOString(),
    })),
  }))
}

export async function deleteNotification(id: string): Promise<void> {
  const owner = state.userId
  await mutate(owner, api.delete(`/notifications/${id}`), () => ({
    items: state.items.filter((item) => item.id !== id),
  }))
}

export async function clearNotifications(): Promise<void> {
  const owner = state.userId
  await mutate(owner, api.delete('/notifications'), () => ({ items: [] }))
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((item) => !item.is_read).length
}

export function formatNotificationDate(value: string): string {
  const date = new Date(value)
  const formattedDate = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const formattedTime = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${formattedDate}, ${formattedTime}`
}
