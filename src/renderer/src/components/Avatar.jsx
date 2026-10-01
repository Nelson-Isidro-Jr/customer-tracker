import { useSettings } from '../context/SettingsContext'

export function initialsOf(name) {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// Photo when there is one, otherwise initials on the theme gradient
export default function Avatar({ name, photo, size = 36, className = '', ring = false, square = false }) {
  const radius = square ? 'rounded-2xl' : 'rounded-full'
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }
  const ringCls = ring ? 'ring-2 ring-white shadow-md' : ''
  if (photo) {
    return (
      <img
        src={photo}
        alt={name || 'Profile photo'}
        style={style}
        draggable={false}
        className={`${radius} ${ringCls} object-cover flex-shrink-0 select-none ${className}`}
      />
    )
  }
  return (
    <div
      style={style}
      className={`${radius} ${ringCls} bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      {initialsOf(name)}
    </div>
  )
}

export function UserAvatar(props) {
  const { settings } = useSettings()
  return <Avatar name={settings.userName} photo={settings.profilePhoto} {...props} />
}
