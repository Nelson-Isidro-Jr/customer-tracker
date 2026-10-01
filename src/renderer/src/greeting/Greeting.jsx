import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sun, Sunset, Moon, Sparkles } from 'lucide-react'
import Avatar from '../components/Avatar'
import { useSettings, useTheme } from '../context/SettingsContext'
import { nextMessage, greetingFor } from './messages'

const EASE = [0.16, 1, 0.3, 1]
const PERIOD_ICON = { morning: Sun, afternoon: Sunset, evening: Moon }

// Full-screen welcome shown when the app opens: time-based greeting, the
// profile photo, a fresh motivational line, and a loading bar that fills
// before the whole screen fades away. Click or press any key to skip.
export default function Greeting({ onDone }) {
  const { settings } = useSettings()
  const { colors } = useTheme()
  const reduce = useReducedMotion()
  const duration = reduce ? 1.2 : 3.2
  const [now] = useState(() => new Date())
  const greet = greetingFor(now)
  const message = useMemo(() => nextMessage(), [])
  const Icon = PERIOD_ICON[greet.period]
  const firstName = (settings.userName || '').split(' ')[0] || 'there'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [onDone])

  const dateLine = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeLine = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  const blob = (color, size, x, y, delay) => (
    <motion.div
      className="absolute rounded-full blur-3xl"
      style={{ width: size, height: size, left: x, top: y, background: color, opacity: 0.55 }}
      animate={reduce ? {} : { x: [0, 40, -30, 0], y: [0, -30, 25, 0], scale: [1, 1.12, 0.95, 1] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )

  return (
    <motion.div
      key="greeting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: EASE }}
      onClick={onDone}
      className="fixed inset-0 z-[20000] overflow-hidden flex items-center justify-center cursor-pointer select-none"
      style={{
        background: `radial-gradient(120% 120% at 20% 10%, ${colors.brand[5]} 0%, ${colors.brand2[7]} 45%, ${colors.sidebar} 100%)`
      }}
    >
      {blob(colors.brand[3], 420, '8%', '12%', 0)}
      {blob(colors.brand2[4], 360, '62%', '55%', 2)}
      {blob(colors.brand[6], 300, '70%', '4%', 4)}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -12, rotate: -30 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-glass/15 backdrop-blur text-white/90 text-xs font-semibold tracking-wide"
        >
          <Icon size={14} /> {dateLine} · {timeLine}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
          className="relative mb-7"
        >
          {!reduce && (
            <motion.span
              className="absolute inset-0 rounded-full bg-glass/30"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
            />
          )}
          <div className="relative rounded-full p-1.5 bg-glass/20 backdrop-blur shadow-2xl">
            <Avatar name={settings.userName} photo={settings.profilePhoto} size={104} className="ring-4 ring-glass/70" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          className="text-lg font-medium text-white/80"
        >
          {greet.text},
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.38 }}
          className="text-5xl font-extrabold tracking-tight text-white mt-1 drop-shadow-sm"
        >
          {firstName}! <motion.span
            className="inline-block origin-[70%_70%]"
            animate={reduce ? {} : { rotate: [0, 18, -8, 18, 0] }}
            transition={{ duration: 1.4, delay: 1 }}
          >👋</motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.65 }}
          className="mt-6 text-base leading-relaxed text-white/90 bg-glass/10 backdrop-blur-md border border-glass/15 rounded-2xl px-6 py-4 max-w-xl shadow-lg"
        >
          {message}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-10 w-72"
        >
          <div className="h-1.5 rounded-full bg-glass/15 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-glass/70 via-glass to-glass/70 shadow-[0_0_12px_rgba(255,255,255,0.7)]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration, ease: [0.65, 0, 0.35, 1], delay: 0.5 }}
              onAnimationComplete={() => { setReady(true); setTimeout(onDone, 350) }}
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/60 tracking-wide">
            <Sparkles size={11} /> {ready ? 'All set — let’s go!' : 'Getting your workspace ready…'}
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-5 inset-x-0 text-center text-[11px] text-white/40">Click anywhere or press any key to skip</div>
    </motion.div>
  )
}
