// Build-time report settings. electron-vite reads them from .env in the project
// root (MAIN_VITE_ prefix) and inlines them into the main bundle at build time,
// so edit .env before running npm run build or build-installer.bat.
const env = import.meta.env

function intInRange(value, fallback, min, max) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export const REPORT_CONFIG = {
  companyName: env.MAIN_VITE_REPORT_COMPANY_NAME || 'Customer Tracker',
  companyAddress: env.MAIN_VITE_REPORT_COMPANY_ADDRESS || '',
  companyContact: env.MAIN_VITE_REPORT_COMPANY_CONTACT || '',
  footerNote: env.MAIN_VITE_REPORT_FOOTER_NOTE || 'Confidential — prepared for internal records',
  topLimit: intInRange(env.MAIN_VITE_REPORT_TOP_LIMIT, 10, 3, 50)
}
