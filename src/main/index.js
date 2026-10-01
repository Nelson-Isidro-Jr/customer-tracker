import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import * as db from './database'
import { REPORT_CONFIG } from './config'
import { buildYearlyReportHtml, buildBuyerStatementHtml } from './pdfTemplates'
import { exportPdf, openPdf, slugify } from './pdfExport'

// ─── Settings ─────────────────────────────────────────────────────────────────

let settingsPath

function getSettingsPath() {
  if (!settingsPath) settingsPath = path.join(app.getPath('userData'), 'settings.json')
  return settingsPath
}

const SETTINGS_DEFAULTS = {
  userName: 'Nelson Isidro',
  pesosPerPoint: 10000,
  showGreeting: true,
  theme: { preset: 'light' }
}

function readSettings() {
  try {
    const p = getSettingsPath()
    if (fs.existsSync(p)) return { ...SETTINGS_DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (_) {}
  return { ...SETTINGS_DEFAULTS }
}

// Keeps the database's actor (shown in the activity log) and points rate in
// step with settings.json.
function syncDbSettings(settings) {
  db.setActor(settings.userName)
  db.setPointsRate(settings.pesosPerPoint)
}

function themeLabel(theme) {
  if (!theme || !theme.preset) return 'Light'
  if (theme.preset === 'custom') return `Custom (${theme.custom?.brand || 'colors'})`
  return theme.preset.charAt(0).toUpperCase() + theme.preset.slice(1)
}

// Which settings changes show up in the activity log, under which action
const SETTINGS_LOG = [
  ['userName', 'Display name', 'profile_updated', v => v || '—'],
  ['profilePhoto', 'Profile photo', 'profile_updated', v => (v ? 'Photo set' : 'No photo')],
  ['theme', 'Theme', 'theme_changed', themeLabel],
  ['pesosPerPoint', 'Pesos per point', 'points_rate_changed', v => `₱${Number(v).toLocaleString('en-PH')}`],
  ['showGreeting', 'Startup greeting', 'settings_updated', v => (v === false ? 'Off' : 'On')],
  ['autoBackupFolder', 'Auto-backup folder', 'settings_updated', v => v || 'Disabled']
]

function logSettingsChanges(before, after) {
  const byAction = {}
  for (const [key, label, action, show] of SETTINGS_LOG) {
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue
    ;(byAction[action] = byAction[action] || []).push({ field: label, from: show(before[key]), to: show(after[key]) })
  }
  const titles = {
    profile_updated: 'Updated profile',
    theme_changed: `Changed theme to ${themeLabel(after.theme)}`,
    points_rate_changed: `Changed points rate to ₱${Number(after.pesosPerPoint).toLocaleString('en-PH')} per point`,
    settings_updated: 'Updated settings'
  }
  for (const [action, changes] of Object.entries(byAction)) {
    db.logActivity({ action, entity_type: 'settings', summary: titles[action], details: { changes } })
  }
}

function writeSettings(data) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf8')
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'Customer Tracker',
    show: false,
    backgroundColor: /^#[0-9a-f]{6}$/i.test(readSettings().windowBackground || '') ? readSettings().windowBackground : '#F1F5F9'
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.once('ready-to-show', () => { win.show(); win.focus() })
}

function runDailyBackup() {
  try {
    const settings = readSettings()
    if (!settings.autoBackupFolder) return
    if (!fs.existsSync(settings.autoBackupFolder)) return
    const now = new Date()
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    const filename = `customer-tracker-auto-${today}.json`
    const fullPath = path.join(settings.autoBackupFolder, filename)
    if (fs.existsSync(fullPath)) return
    const data = db.exportAllData()
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8')
    writeSettings({ ...settings, autoBackupLastRun: new Date().toISOString() })
    db.logActivity({ action: 'backup_created', entity_type: 'data', summary: `Automatic backup saved as ${filename}` })
    console.log(`[auto-backup] wrote ${fullPath}`)
  } catch (err) {
    console.error('[auto-backup] failed:', err)
  }
}

// The first time a new version starts, copy the existing database (and its
// WAL journal) aside before anything opens it, so an upgrade can never cost a
// customer their data. Keeps the five most recent copies.
function backupBeforeUpgrade() {
  try {
    const settings = readSettings()
    const version = app.getVersion()
    if (settings.lastRunVersion === version) return
    const dir = app.getPath('userData')
    const dbFile = path.join(dir, 'customer-tracker.db')
    let saved = null
    if (fs.existsSync(dbFile)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const root = path.join(dir, 'backups')
      const dest = path.join(root, `before-${version}-${stamp}`)
      fs.mkdirSync(dest, { recursive: true })
      for (const suffix of ['', '-wal', '-shm']) {
        if (fs.existsSync(dbFile + suffix)) fs.copyFileSync(dbFile + suffix, path.join(dest, `customer-tracker.db${suffix}`))
      }
      const old = fs.readdirSync(root).filter(n => n.startsWith('before-')).sort().reverse().slice(5)
      for (const n of old) fs.rmSync(path.join(root, n), { recursive: true, force: true })
      saved = dest
    }
    writeSettings({ ...settings, lastRunVersion: version })
    if (saved) {
      db.logActivity({
        action: 'app_updated',
        entity_type: 'data',
        summary: `Updated to version ${version}${settings.lastRunVersion ? ` from ${settings.lastRunVersion}` : ''}. Previous database saved to backups/${path.basename(saved)}`
      })
    }
  } catch (err) {
    console.error('[upgrade-backup] failed:', err)
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  syncDbSettings(readSettings())
  backupBeforeUpgrade()
  createWindow()
  runDailyBackup()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC wrapper — surfaces real error messages to the renderer ───────────────

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (err) {
      console.error(`[IPC] ${channel}:`, err)
      throw new Error(err.message || String(err))
    }
  })
}

// ─── IPC: Settings ────────────────────────────────────────────────────────────
handle('settings:get', () => readSettings())
handle('settings:set', (_, data) => {
  const before = readSettings()
  const next = { ...SETTINGS_DEFAULTS, ...data }
  writeSettings(next)
  syncDbSettings(next)
  logSettingsChanges(before, next)
  return true
})

handle('app:info', () => ({ version: app.getVersion() }))

// Returns the picked image as a data URL; the renderer crops and resizes it
// with canvas, which decodes more formats (WebP, GIF, BMP) than nativeImage.
handle('profile:pickPhoto', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Choose a profile photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
  })
  if (!filePaths?.[0]) return null
  const file = filePaths[0]
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw new Error('Please choose an image under 20 MB')
  const ext = path.extname(file).slice(1).toLowerCase()
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' }[ext] || 'image/png'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
})

handle('dialog:pickFolder', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Choose backup folder',
    properties: ['openDirectory', 'createDirectory']
  })
  return filePaths?.[0] || null
})

handle('data:autoBackupNow', () => {
  runDailyBackup()
  return readSettings().autoBackupLastRun || null
})

// ─── IPC: Customers ───────────────────────────────────────────────────────────
handle('customers:getAll',    ()               => db.getAllCustomers())
handle('customers:page',      (_, opts)        => db.getCustomersPage(opts || {}))
handle('customers:summary',   ()               => db.getCustomerSummary())
handle('customers:searchLite',(_, { query, limit } = {}) => db.searchCustomersLite(query, limit))
handle('customers:getAllLite',()               => db.getAllCustomersLite())
handle('customers:getById',   (_, id)          => db.getCustomerById(id))
handle('customers:add',       (_, data)        => db.addCustomer(data))
handle('customers:update',    (_, { id, data }) => db.updateCustomer(id, data))
handle('customers:delete',    (_, id)          => db.deleteCustomer(id))
handle('customers:search',    (_, q)           => db.searchCustomers(q))

// ─── IPC: Transactions ────────────────────────────────────────────────────────
handle('transactions:getByCustomer', (_, cid)     => db.getTransactionsByCustomer(cid))
handle('transactions:getAll',        (_, filters) => db.getAllTransactions(filters || {}))
handle('transactions:page',          (_, opts)    => db.getTransactionsPage(opts || {}))
handle('transactions:recent',        (_, limit)   => db.getRecentTransactions(limit || 10))
handle('transactions:add',           (_, data)    => db.addTransaction(data))
handle('transactions:update',        (_, { id, data }) => db.updateTransaction(id, data))
handle('transactions:delete',        (_, id)      => db.deleteTransaction(id))

// ─── IPC: Activity Log ────────────────────────────────────────────────────────
handle('activity:getPage', (_, opts) => db.getActivityPage(opts || {}))
handle('activity:counts',  ()         => db.getActivityCounts())

// ─── IPC: Rewards ─────────────────────────────────────────────────────────────
handle('rewards:summary',         ()                => db.getRewardsSummary())
handle('rewards:prizes',          ()                => db.getPrizes())
handle('rewards:addPrize',        (_, data)         => db.addPrize(data))
handle('rewards:updatePrize',     (_, { id, data }) => db.updatePrize(id, data))
handle('rewards:deletePrize',     (_, id)           => db.deletePrize(id))
handle('rewards:customerPoints',  (_, id)           => db.getCustomerPoints(id))
handle('rewards:pointsHistory',   (_, id)           => db.getPointsHistory(id))
handle('rewards:redeem',          (_, opts)         => db.redeemPrize(opts))
handle('rewards:cancel',          (_, id)           => db.cancelRedemption(id))
handle('rewards:adjust',          (_, opts)         => db.adjustPoints(opts))
handle('rewards:pointsPage',      (_, opts)         => db.getPointsPage(opts || {}))
handle('rewards:redemptionsPage', (_, opts)         => db.getRedemptionsPage(opts || {}))
handle('activity:clear',   ()         => { db.clearActivityLog(); return true })

// ─── IPC: Analytics ───────────────────────────────────────────────────────────
handle('analytics:dashboard',        ()                          => db.getDashboardStats())
handle('analytics:bestBuyerMonthly', (_, { year, month })       => db.getBestBuyerMonthly(year, month))
handle('analytics:bestBuyerYearly',  (_, year)                  => db.getBestBuyerYearly(year))
handle('analytics:monthlyRevenue',   (_, year)                  => db.getMonthlyRevenue(year))
handle('analytics:topBuyers',        (_, { year, month, limit }) => db.getTopBuyers(year, month, limit))

// ─── IPC: Reports ─────────────────────────────────────────────────────────────
handle('reports:daily',   (_, date)            => db.getDailyReport(date))
handle('reports:monthly', (_, { year, month }) => db.getMonthlyReport(year, month))
handle('reports:years',        ()                        => db.getReportYears())
handle('reports:yearly',       (_, year)                 => db.getYearlyReport(year, REPORT_CONFIG.topLimit))
handle('reports:yearlyBuyers', (_, year)                 => db.getYearlyBuyers(year))
handle('reports:buyerYearly',  (_, { customerId, year }) => db.getBuyerYearlyStatement(customerId, year))

// ─── IPC: PDF Export ──────────────────────────────────────────────────────────
function pdfMeta() {
  return { brand: REPORT_CONFIG, preparedBy: readSettings().userName || 'Nelson Isidro', generatedAt: new Date() }
}

function logExport(action, summary, res) {
  if (res?.success) db.logActivity({ action, entity_type: 'data', summary: `${summary} (${path.basename(res.path)})` })
  return res
}

handle('reports:exportYearlyPdf', async (_, year) => {
  const report = db.getYearlyReport(year, REPORT_CONFIG.topLimit)
  const res = await exportPdf({
    html: buildYearlyReportHtml(report, pdfMeta()),
    footerLabel: `${REPORT_CONFIG.companyName} · Annual Sales Report ${report.year}`,
    defaultName: `annual-sales-report-${report.year}.pdf`,
    title: 'Export Annual Report to PDF'
  })
  return logExport('report_exported', `Exported Annual Sales Report ${report.year} to PDF`, res)
})

handle('reports:exportBuyerPdf', async (_, { customerId, year }) => {
  const statement = db.getBuyerYearlyStatement(customerId, year)
  const name = statement.customer.full_name
  const res = await exportPdf({
    html: buildBuyerStatementHtml(statement, pdfMeta()),
    footerLabel: `${REPORT_CONFIG.companyName} · ${name} · Statement & Audit ${statement.year}`,
    defaultName: `customer-statement-${slugify(name)}-${statement.year}.pdf`,
    title: 'Export Customer Statement to PDF'
  })
  return logExport('report_exported', `Exported ${name}'s ${statement.year} statement to PDF`, res)
})

handle('reports:openPdf', (_, filePath) => openPdf(filePath))

// ─── IPC: Data Import / Export ────────────────────────────────────────────────
handle('data:clearAll', () => db.clearAllData())

handle('data:export', async () => {
  const data = db.exportAllData()
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Database Backup',
    defaultPath: `customer-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }]
  })
  if (!filePath) return { success: false }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return logExport('data_exported', `Exported backup of ${data.customers.length} customers and ${data.transactions.length} transactions`, { success: true, path: filePath })
})

handle('data:import', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import Database Backup',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { success: false }
  const raw = fs.readFileSync(filePaths[0], 'utf8')
  db.importData(JSON.parse(raw))
  return { success: true }
})

handle('data:exportExcel', async (_, { type, filters }) => {
  // Lazy-load xlsx so startup errors from the DB don't interfere
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  if (type === 'all') {
    const { transactions } = db.exportAllData()
    const customers = db.getAllCustomers()
    const cMap = {}
    customers.forEach(c => { cMap[c.id] = c.full_name })

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers.map(c => ({
      'ID': c.id, 'Full Name': c.full_name, 'Email': c.email || '',
      'Phone': c.phone || '', 'Notes': c.notes || '', 'Registered': c.created_at,
      'Total Spent (PHP)': c.total_purchases, 'Transactions': c.transaction_count,
      'Points Balance': c.points_balance
    }))), 'Customers')

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactions.map(t => ({
      'ID': t.id, 'Customer': cMap[t.customer_id] || 'Unknown',
      'Amount (PHP)': t.amount, 'Description': t.description || '',
      'Date': t.date, 'Recorded At': t.created_at
    }))), 'Transactions')

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export All Data to Excel',
      defaultPath: `customer-tracker-all-${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel File', extensions: ['xlsx'] }]
    })
    if (!filePath) return { success: false }
    XLSX.writeFile(wb, filePath)
    return logExport('excel_exported', `Exported all ${customers.length} customers and ${transactions.length} transactions to Excel`, { success: true, path: filePath })
  }

  if (type === 'daily' || type === 'monthly') {
    const report = type === 'daily'
      ? db.getDailyReport(filters.date)
      : db.getMonthlyReport(filters.year, filters.month)

    const rows = report.transactions.map(t => ({
      'Date': t.date, 'Customer': t.customer_name,
      'Amount (PHP)': t.amount, 'Description': t.description || ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.sheet_add_aoa(ws, [[], ['', 'TOTAL (PHP)', report.total]], { origin: rows.length + 1 })
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')

    const label = type === 'daily'
      ? filters.date
      : `${filters.year}-${String(filters.month).padStart(2, '0')}`
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Report to Excel',
      defaultPath: `sales-report-${label}.xlsx`,
      filters: [{ name: 'Excel File', extensions: ['xlsx'] }]
    })
    if (!filePath) return { success: false }
    XLSX.writeFile(wb, filePath)
    return logExport('excel_exported', `Exported ${type} sales report for ${label} to Excel`, { success: true, path: filePath })
  }

  return { success: false }
})
