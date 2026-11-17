import { initials } from '../lib/format'
import { SYSTEM_AVATARS } from '../pages/mentor/profileData'

export function ProfileAvatar({
  name,
  avatar,
  className = 'h-10 w-10 text-base',
}: {
  name: string
  avatar?: string
  className?: string
}) {
  const systemAvatar = SYSTEM_AVATARS.find((item) => item.id === avatar)
  const baseClass = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`

  if (avatar?.startsWith('data:image/')) {
    return <img src={avatar} alt={`Foto profil ${name}`} className={`${baseClass} object-cover`} />
  }

  if (systemAvatar) {
    return (
      <span role="img" aria-label={`Avatar ${systemAvatar.label}`} className={`${baseClass} ${systemAvatar.background}`}>
        <span aria-hidden className="leading-none">{systemAvatar.emoji}</span>
      </span>
    )
  }

  return <span aria-label={`Inisial ${name}`} className={`${baseClass} bg-gold-400 font-bold text-ink-900`}>{initials(name)}</span>
}
