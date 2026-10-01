import { app, BrowserWindow, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { footerTemplate } from './pdfTemplates'

// Paths written by exportPdf this session. openPdf only opens these, so the
// renderer can never ask the main process to launch an arbitrary file.
const exportedFiles = new Set()

// A4 with ~12mm side margins; the bottom margin holds the page-number footer.
const PRINT_OPTIONS = {
  pageSize: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  margins: { top: 0.47, bottom: 0.6, left: 0.47, right: 0.47 }
}

async function renderPdf(html, footerLabel) {
  const tmp = path.join(app.getPath('temp'), `customer-tracker-report-${Date.now()}.html`)
  fs.writeFileSync(tmp, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await win.loadFile(tmp)
    return await win.webContents.printToPDF({ ...PRINT_OPTIONS, footerTemplate: footerTemplate(footerLabel) })
  } finally {
    win.destroy()
    fs.rm(tmp, { force: true }, () => {})
  }
}

export async function exportPdf({ html, footerLabel, defaultName, title }) {
  const { filePath } = await dialog.showSaveDialog({
    title,
    defaultPath: defaultName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
  })
  if (!filePath) return { success: false }
  const pdf = await renderPdf(html, footerLabel)
  fs.writeFileSync(filePath, pdf)
  exportedFiles.add(filePath)
  return { success: true, path: filePath }
}

export async function openPdf(filePath) {
  if (!exportedFiles.has(filePath)) throw new Error('Only reports exported in this session can be opened')
  const err = await shell.openPath(filePath)
  if (err) throw new Error(err)
  return true
}

export function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer'
}
