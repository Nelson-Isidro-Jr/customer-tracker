import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

// Counts from the last shown value to the new one with an ease-out curve.
// Interrupted animations resume from wherever the number currently is, and the
// OS "reduce motion" setting snaps straight to the final value.
export default function AnimatedNumber({ value, format = v => v, duration = 0.9 }) {
  const reduce = useReducedMotion()
  const current = useRef(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const target = Number(value) || 0
    if (reduce) {
      current.current = target
      setDisplay(target)
      return
    }
    const controls = animate(current.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => { current.current = v; setDisplay(v) }
    })
    return () => controls.stop()
  }, [value, reduce, duration])

  return <span>{format(display)}</span>
}
