import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import * as db from './database'

// ─── Settings ─────────────────────────────────────────────────────────────────

let settingsPath

function getSettingsPath() {
  if (!settingsPath) settingsPath = path.join(app.getPath('userData'), 'settings.json')
  return settingsPath
}

function readSettings() {
  try {
    const p = getSettingsPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (_) {}
  return { userName: 'Nelson Isidro' }
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
    backgroundColor: '#F1F5F9'
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
    const today = new Date().toISOString().slice(0, 10)
    const filename = `customer-tracker-auto-${today}.json`
    const fullPath = path.join(settings.autoBackupFolder, filename)
    if (fs.existsSync(fullPath)) return
    const data = db.exportAllData()
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8')
    writeSettings({ ...settings, autoBackupLastRun: new Date().toISOString() })
    console.log(`[auto-backup] wrote ${fullPath}`)
  } catch (err) {
    console.error('[auto-backup] failed:', err)
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
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
handle('settings:set', (_, data) => { writeSettings(data); return true })

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
handle('customers:getAllLite',()               => db.getAllCustomersLite())
handle('customers:getById',   (_, id)          => db.getCustomerById(id))
handle('customers:add',       (_, data)        => db.addCustomer(data))
handle('customers:update',    (_, { id, data }) => db.updateCustomer(id, data))
handle('customers:delete',    (_, id)          => db.deleteCustomer(id))
handle('customers:search',    (_, q)           => db.searchCustomers(q))

// ─── IPC: Transactions ────────────────────────────────────────────────────────
handle('transactions:getByCustomer', (_, cid)     => db.getTransactionsByCustomer(cid))
handle('transactions:getAll',        (_, filters) => db.getAllTransactions(filters || {}))
handle('transactions:add',           (_, data)    => db.addTransaction(data))
handle('transactions:update',        (_, { id, data }) => db.updateTransaction(id, data))
handle('transactions:delete',        (_, id)      => db.deleteTransaction(id))

// ─── IPC: Analytics ───────────────────────────────────────────────────────────
handle('analytics:dashboard',        ()                          => db.getDashboardStats())
handle('analytics:bestBuyerMonthly', (_, { year, month })       => db.getBestBuyerMonthly(year, month))
handle('analytics:bestBuyerYearly',  (_, year)                  => db.getBestBuyerYearly(year))
handle('analytics:monthlyRevenue',   (_, year)                  => db.getMonthlyRevenue(year))
handle('analytics:topBuyers',        (_, { year, month, limit }) => db.getTopBuyers(year, month, limit))

// ─── IPC: Reports ─────────────────────────────────────────────────────────────
handle('reports:daily',   (_, date)            => db.getDailyReport(date))
handle('reports:monthly', (_, { year, month }) => db.getMonthlyReport(year, month))

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
  return { success: true, path: filePath }
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
    const { customers, transactions } = db.exportAllData()
    const cMap = {}
    customers.forEach(c => { cMap[c.id] = c.full_name })

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers.map(c => ({
      'ID': c.id, 'Full Name': c.full_name, 'Email': c.email || '',
      'Phone': c.phone || '', 'Notes': c.notes || '', 'Registered': c.created_at
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
    return { success: true, path: filePath }
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
    return { success: true, path: filePath }
  }

  return { success: false }
})
