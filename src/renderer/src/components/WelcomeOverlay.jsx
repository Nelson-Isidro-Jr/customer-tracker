import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../context/SettingsContext'

// Module scope, so the greeting plays once per app launch rather than on every
// route change back to the dashboard.
let alreadyGreeted = false

function greetingFor(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const line = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } }
}

export default function WelcomeOverlay() {
  const { settings } = useSettings()
  const [show, setShow] = useState(!alreadyGreeted)

  useEffect(() => {
    if (alreadyGreeted) return
    alreadyGreeted = true
    const t = setTimeout(() => setShow(false), 2800)
    return () => clearTimeout(t)
  }, [])

  const name = settings?.userName || 'there'
  const firstName = name.split(' ')[0]
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const now = new Date()

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeInOut' } }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[10000] flex items-center justify-center cursor-pointer bg-[#0B1120]"
        >
          {/* Soft moving glow behind the card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="absolute w-[520px] h-[520px] rounded-full blur-[120px] bg-blue-600/40"
          />

          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.13, delayChildren: 0.15 } } }}
            initial="hidden"
            animate="show"
            exit={{ y: -18, opacity: 0, transition: { duration: 0.35 } }}
            className="relative flex flex-col items-center text-center px-8"
          >
            {/* Avatar */}
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.5, y: -30 },
                show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 18 } }
              }}
              className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/10 shadow-2xl mb-6 bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center"
            >
              {settings?.avatar
                ? <img src={settings.avatar} alt="" className="w-full h-full object-cover" />
                : <span className="text-white text-3xl font-bold tracking-tight">{initials}</span>}
            </motion.div>

            <motion.p variants={line} className="text-blue-400 text-sm font-semibold uppercase tracking-[0.2em]">
              {greetingFor(now.getHours())}
            </motion.p>

            <motion.h1 variants={line} className="text-white text-4xl font-bold mt-2 tracking-tight">
              Hello, {firstName}!
            </motion.h1>

            <motion.p variants={line} className="text-slate-400 text-sm mt-3">
              {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </motion.p>

            <motion.div
              variants={line}
              className="mt-8 h-0.5 w-40 rounded-full bg-white/10 overflow-hidden"
            >
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 2.4, ease: 'easeInOut' }}
                className="h-full w-full bg-blue-500"
              />
            </motion.div>

            <motion.p variants={line} className="text-slate-600 text-[11px] mt-5">
              Click anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
