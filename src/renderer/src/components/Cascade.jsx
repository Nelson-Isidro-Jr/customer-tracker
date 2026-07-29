import { motion } from 'framer-motion'

/**
 * Page-level entrance animation.
 *
 * Sections cascade in reading order — top-left first, then across and down —
 * each popping up from slightly above and to the left. Layout keys its wrapper
 * on the route, so <Page> remounts and re-runs the cascade on every tab switch.
 *
 * This deliberately animates *containers* only, never table rows: staggering
 * thousands of rows is what made the Transactions tab crawl.
 */
export const cascadeContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 }
  }
}

export const cascadeItem = {
  hidden: { opacity: 0, y: -16, x: -12, scale: 0.97 },
  show: {
    opacity: 1, y: 0, x: 0, scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30, mass: 0.7 }
  }
}

/** Root of a page. Replaces `<div className="page-container">`. */
export function Page({ children, className = '' }) {
  return (
    <motion.div
      variants={cascadeContainer}
      initial="hidden"
      animate="show"
      className={`page-container ${className}`}
    >
      {children}
    </motion.div>
  )
}

/** A row/grid whose own children cascade individually, one after another. */
export const cascadeGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
}

/**
 * One cascading section. Nested motion children inherit the hidden/show state
 * automatically, so grids of cards can pop individually by using <Pop> inside.
 */
export function Pop({ children, className = '', ...rest }) {
  return (
    <motion.div variants={cascadeItem} className={className} {...rest}>
      {children}
    </motion.div>
  )
}

/** Grid wrapper: staggers its <Pop> children instead of popping as one block. */
export function PopGrid({ children, className = '', ...rest }) {
  return (
    <motion.div variants={cascadeGroup} className={className} {...rest}>
      {children}
    </motion.div>
  )
}
