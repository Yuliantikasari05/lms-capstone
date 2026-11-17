export interface MentorProfilePreferences {
  name: string
  jobTitle: string
  location: string
  avatar: string
}

export const SYSTEM_AVATARS = [
  { id: 'system:teacher-blue', label: 'Pengajar', emoji: '👩🏻‍🏫', background: 'bg-blue-100' },
  { id: 'system:teacher-violet', label: 'Mentor', emoji: '👨🏽‍🏫', background: 'bg-violet-100' },
  { id: 'system:developer-teal', label: 'Developer', emoji: '🧑🏼‍💻', background: 'bg-teal-100' },
  { id: 'system:developer-rose', label: 'Kreatif', emoji: '👩🏿‍💻', background: 'bg-rose-100' },
  { id: 'system:cat-amber', label: 'Kucing', emoji: '🐱', background: 'bg-amber-100' },
  { id: 'system:cat-indigo', label: 'Kucing ceria', emoji: '😺', background: 'bg-indigo-100' },
] as const

const profiles = new Map<number, MentorProfilePreferences>()
const listeners = new Set<() => void>()

export function getMentorProfile(userId: number, defaultName: string): MentorProfilePreferences {
  const profile = profiles.get(userId)
  if (profile) return profile

  const initialProfile = {
    name: defaultName,
    jobTitle: 'Mentor LMS',
    location: 'Indonesia',
    avatar: 'system:teacher-blue',
  }
  profiles.set(userId, initialProfile)
  return initialProfile
}

export function subscribeMentorProfile(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function saveMentorProfile(userId: number, profile: MentorProfilePreferences) {
  profiles.set(userId, profile)
  listeners.forEach((listener) => listener())
}
