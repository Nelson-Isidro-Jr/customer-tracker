import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db

function getDB() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'customer-tracker.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date        ON transactions(date);

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      customer_name TEXT,
      summary TEXT,
      amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_action     ON activity_log(action);
  `)
}

function logActivity({ action, entity_type, entity_id = null, customer_name = null, summary = null, amount = null }) {
  try {
    getDB().prepare(`
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, summary, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(action, entity_type, entity_id, customer_name, summary, amount)
  } catch (err) {
    console.error('[activity_log] insert failed:', err)
  }
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function getAllCustomers() {
  return getDB().prepare(`
    SELECT c.*,
           COALESCE(SUM(t.amount), 0) AS total_purchases,
           COUNT(t.id)                AS transaction_count,
           MAX(t.date)                AS last_purchase
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
    GROUP BY c.id
    ORDER BY total_purchases DESC
  `).all()
}

export function getAllCustomersLite() {
  return getDB().prepare(`SELECT id, full_name FROM customers ORDER BY full_name`).all()
}

export function getCustomerById(id) {
  return getDB().prepare(`
    SELECT c.*,
           COALESCE(SUM(t.amount), 0) AS total_purchases,
           COUNT(t.id)                AS transaction_count,
           MAX(t.date)                AS last_purchase
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id)
}

export function addCustomer(data) {
  const result = getDB().prepare(`
    INSERT INTO customers (full_name, email, phone, notes) VALUES (?, ?, ?, ?)
  `).run(data.full_name, data.email || null, data.phone || null, data.notes || null)
  logActivity({
    action: 'customer_added',
    entity_type: 'customer',
    entity_id: result.lastInsertRowid,
    customer_name: data.full_name,
    summary: `Added customer ${data.full_name}`
  })
  return getCustomerById(result.lastInsertRowid)
}

export function updateCustomer(id, data) {
  getDB().prepare(`
    UPDATE customers SET full_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?
  `).run(data.full_name, data.email || null, data.phone || null, data.notes || null, id)
  logActivity({
    action: 'customer_edited',
    entity_type: 'customer',
    entity_id: id,
    customer_name: data.full_name,
    summary: `Edited customer ${data.full_name}`
  })
  return getCustomerById(id)
}

export function deleteCustomer(id) {
  const existing = getDB().prepare('SELECT full_name FROM customers WHERE id = ?').get(id)
  getDB().prepare('DELETE FROM customers WHERE id = ?').run(id)
  if (existing) {
    logActivity({
      action: 'customer_deleted',
      entity_type: 'customer',
      entity_id: id,
      customer_name: existing.full_name,
      summary: `Deleted customer ${existing.full_name}`
    })
  }
}

export function searchCustomers(query) {
  const like = `%${query}%`
  return getDB().prepare(`
    SELECT c.*,
           COALESCE(SUM(t.amount), 0) AS total_purchases,
           COUNT(t.id)                AS transaction_count,
           MAX(t.date)                AS last_purchase
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
    WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
    GROUP BY c.id
    ORDER BY total_purchases DESC
  `).all(like, like, like)
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function getTransactionsByCustomer(customerId) {
  return getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.customer_id = ?
    ORDER BY t.date DESC, t.created_at DESC
  `).all(customerId)
}

export function getAllTransactions(filters = {}) {
  let query = `
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE 1=1
  `
  const params = []
  if (filters.startDate) { query += ' AND t.date >= ?'; params.push(filters.startDate) }
  if (filters.endDate)   { query += ' AND t.date <= ?'; params.push(filters.endDate) }
  if (filters.customerId){ query += ' AND t.customer_id = ?'; params.push(filters.customerId) }
  query += ' ORDER BY t.date DESC, t.created_at DESC'
  return getDB().prepare(query).all(...params)
}

export function addTransaction(data) {
  const result = getDB().prepare(`
    INSERT INTO transactions (customer_id, amount, description, date) VALUES (?, ?, ?, ?)
  `).run(data.customer_id, data.amount, data.description || null, data.date)
  const cust = getDB().prepare('SELECT full_name FROM customers WHERE id = ?').get(data.customer_id)
  logActivity({
    action: 'transaction_added',
    entity_type: 'transaction',
    entity_id: result.lastInsertRowid,
    customer_name: cust?.full_name || null,
    summary: data.description || null,
    amount: data.amount
  })
  return { id: result.lastInsertRowid, ...data }
}

export function updateTransaction(id, data) {
  getDB().prepare(`
    UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ?
  `).run(data.amount, data.description || null, data.date, id)
  const row = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(id)
  if (row) {
    logActivity({
      action: 'transaction_edited',
      entity_type: 'transaction',
      entity_id: id,
      customer_name: row.customer_name,
      summary: data.description || null,
      amount: data.amount
    })
  }
  return row
}

export function deleteTransaction(id) {
  const existing = getDB().prepare(`
    SELECT t.amount, t.description, c.full_name AS customer_name
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(id)
  getDB().prepare('DELETE FROM transactions WHERE id = ?').run(id)
  if (existing) {
    logActivity({
      action: 'transaction_deleted',
      entity_type: 'transaction',
      entity_id: id,
      customer_name: existing.customer_name,
      summary: existing.description || null,
      amount: existing.amount
    })
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getDashboardStats() {
  const d = getDB()
  const ym = new Date().toISOString().slice(0, 7)
  return {
    totalRevenue:      d.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM transactions').get().v,
    totalCustomers:    d.prepare('SELECT COUNT(*) AS v FROM customers').get().v,
    totalTransactions: d.prepare('SELECT COUNT(*) AS v FROM transactions').get().v,
    monthlyRevenue:    d.prepare(`SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE strftime('%Y-%m',date)=?`).get(ym).v
  }
}

export function getBestBuyerMonthly(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE strftime('%Y-%m', t.date) = ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(ym)
}

export function getBestBuyerYearly(year) {
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE strftime('%Y', t.date) = ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(String(year))
}

export function getMonthlyRevenue(year) {
  return getDB().prepare(`
    SELECT strftime('%m', date) AS month,
           SUM(amount)          AS total,
           COUNT(*)             AS count
    FROM transactions
    WHERE strftime('%Y', date) = ?
    GROUP BY month ORDER BY month
  `).all(String(year))
}

export function getTopBuyers(year, month, limit = 5) {
  let where = ''
  const params = []
  if (year && month) {
    where = `WHERE strftime('%Y-%m', t.date) = ?`
    params.push(`${year}-${String(month).padStart(2, '0')}`)
  } else if (year) {
    where = `WHERE strftime('%Y', t.date) = ?`
    params.push(String(year))
  }
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${where}
    GROUP BY c.id ORDER BY total_amount DESC LIMIT ${limit}
  `).all(...params)
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function getDailyReport(date) {
  const transactions = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date = ?
    ORDER BY t.created_at DESC
  `).all(date)
  const total = transactions.reduce((s, t) => s + t.amount, 0)
  return { date, transactions, total, count: transactions.length }
}

export function getMonthlyReport(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const transactions = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE strftime('%Y-%m', t.date) = ?
    ORDER BY t.date DESC, t.created_at DESC
  `).all(ym)
  const total = transactions.reduce((s, t) => s + t.amount, 0)
  const bestBuyer = getBestBuyerMonthly(year, month)
  const dailyBreakdown = getDB().prepare(`
    SELECT date, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
    GROUP BY date ORDER BY date
  `).all(ym)
  return { year, month: ym, transactions, total, count: transactions.length, bestBuyer, dailyBreakdown }
}

// ─── Yearly Report ────────────────────────────────────────────────────────────

// Date-range bounds instead of strftime so the yearly queries hit idx_transactions_date
function yearRange(year) {
  return [`${year}-01-01`, `${year}-12-31`]
}

function monthlySeries(year, customerId = null) {
  const params = yearRange(year)
  let where = 'date BETWEEN ? AND ?'
  if (customerId) { where += ' AND customer_id = ?'; params.push(customerId) }
  const rows = getDB().prepare(`
    SELECT CAST(strftime('%m', date) AS INTEGER) AS month,
           SUM(amount)                           AS total,
           COUNT(*)                              AS count
    FROM transactions
    WHERE ${where}
    GROUP BY month
  `).all(...params)
  return Array.from({ length: 12 }, (_, i) => {
    const r = rows.find(x => x.month === i + 1)
    return { month: i + 1, total: r?.total || 0, count: r?.count || 0 }
  })
}

// Month-over-month growth. January compares against the previous December. The
// month in progress and months that have not happened yet get no growth figure,
// so a partial month never reads as a sharp drop.
function withGrowth(monthly, prevMonthly, year) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  let cumulative = 0
  return monthly.map((m, i) => {
    const isFuture = year > currentYear || (year === currentYear && m.month > currentMonth)
    const inProgress = year === currentYear && m.month === currentMonth
    const prev = i === 0 ? prevMonthly[11].total : monthly[i - 1].total
    cumulative += m.total
    let growth = null
    if (!isFuture && !inProgress && prev > 0) growth = ((m.total - prev) / prev) * 100
    return {
      ...m,
      prevYearTotal: prevMonthly[i].total,
      growth,
      cumulative: isFuture ? null : cumulative,
      isFuture,
      inProgress
    }
  })
}

// While a year is still running, compare it with the same stretch of the year
// before (Jan 1 to today's date) instead of that year's full total.
function comparisonPeriod(year) {
  const now = new Date()
  if (year !== now.getFullYear()) return { through: '12-31', label: String(year - 1), isYtd: false }
  const through = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { through, label: `${year - 1} YTD`, isYtd: true }
}

function yearTotals(year, customerId = null, through = '12-31') {
  const params = [`${year}-01-01`, `${year}-${through}`]
  let where = 'date BETWEEN ? AND ?'
  if (customerId) { where += ' AND customer_id = ?'; params.push(customerId) }
  return getDB().prepare(`
    SELECT COALESCE(SUM(amount), 0)    AS total,
           COUNT(*)                    AS count,
           COUNT(DISTINCT customer_id) AS buyers
    FROM transactions
    WHERE ${where}
  `).get(...params)
}

function pctChange(current, previous) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null
}

export function getReportYears() {
  const rows = getDB().prepare(`
    SELECT DISTINCT CAST(strftime('%Y', date) AS INTEGER) AS year
    FROM transactions
    WHERE date IS NOT NULL
    ORDER BY year DESC
  `).all()
  return rows.map(r => r.year).filter(Boolean)
}

export function getYearlyBuyers(year) {
  const y = Number(year)
  const rows = getDB().prepare(`
    SELECT c.id, c.full_name, c.email, c.phone,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count,
           MAX(t.date)   AS last_purchase
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY total_amount DESC
  `).all(...yearRange(y))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

export function getYearlyReport(year, limit = 10) {
  const d = getDB()
  const y = Number(year)
  const range = yearRange(y)
  const comparison = comparisonPeriod(y)
  const totals = yearTotals(y)
  const prevTotals = yearTotals(y - 1, null, comparison.through)
  const monthly = withGrowth(monthlySeries(y), monthlySeries(y - 1), y)

  const topBuyers = d.prepare(`
    SELECT c.id, c.full_name, c.email, c.phone,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count,
           MAX(t.amount) AS largest_amount,
           MAX(t.date)   AS last_purchase
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT ?
  `).all(...range, limit)

  const topTransactions = d.prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    ORDER BY t.amount DESC, t.date DESC LIMIT ?
  `).all(...range, limit)

  const active = monthly.filter(m => m.count > 0)
  const bestMonth = active.length
    ? active.reduce((best, m) => (m.total > best.total ? m : best))
    : null

  return {
    year: y,
    totals: {
      ...totals,
      average: totals.count ? totals.total / totals.count : 0,
      revenueGrowth: pctChange(totals.total, prevTotals.total),
      countGrowth: pctChange(totals.count, prevTotals.count),
      buyersGrowth: pctChange(totals.buyers, prevTotals.buyers)
    },
    prevTotals,
    comparison,
    monthly,
    bestMonth,
    topBuyers: topBuyers.map(b => ({
      ...b,
      share: totals.total ? (b.total_amount / totals.total) * 100 : 0
    })),
    topTransactions
  }
}

export function getBuyerYearlyStatement(customerId, year) {
  const d = getDB()
  const y = Number(year)
  const id = Number(customerId)
  const customer = getCustomerById(id)
  if (!customer) throw new Error('Customer not found')

  const range = yearRange(y)
  const rows = d.prepare(`
    SELECT id, amount, description, date, created_at
    FROM transactions
    WHERE customer_id = ? AND date BETWEEN ? AND ?
    ORDER BY date ASC, created_at ASC, id ASC
  `).all(id, ...range)

  let running = 0
  const transactions = rows.map(t => {
    running += t.amount
    return { ...t, running_total: running }
  })

  const monthly = withGrowth(monthlySeries(y, id), monthlySeries(y - 1, id), y)
  const comparison = comparisonPeriod(y)
  const prev = yearTotals(y - 1, id, comparison.through)
  const yearAll = yearTotals(y)

  const ranking = d.prepare(`
    SELECT customer_id
    FROM transactions
    WHERE date BETWEEN ? AND ?
    GROUP BY customer_id ORDER BY SUM(amount) DESC
  `).all(...range)
  const rankIndex = ranking.findIndex(r => r.customer_id === id)

  const total = running
  const count = transactions.length
  const largest = count ? transactions.reduce((a, b) => (b.amount > a.amount ? b : a)) : null
  const smallest = count ? transactions.reduce((a, b) => (b.amount < a.amount ? b : a)) : null
  const active = monthly.filter(m => m.count > 0)
  const bestMonth = active.length ? active.reduce((a, b) => (b.total > a.total ? b : a)) : null

  // Average spacing between distinct purchase dates — a simple buying-cadence signal
  const days = [...new Set(transactions.map(t => t.date))]
  let avgDaysBetween = null
  if (days.length > 1) {
    const span = (new Date(days[days.length - 1]) - new Date(days[0])) / 86400000
    avgDaysBetween = span / (days.length - 1)
  }

  return {
    year: y,
    customer,
    transactions,
    monthly,
    comparison,
    audit: {
      total,
      count,
      average: count ? total / count : 0,
      largest,
      smallest,
      firstPurchase: count ? transactions[0].date : null,
      lastPurchase: count ? transactions[count - 1].date : null,
      activeMonths: active.length,
      bestMonth,
      avgDaysBetween,
      prevTotal: prev.total,
      prevCount: prev.count,
      growth: pctChange(total, prev.total),
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      buyerCount: ranking.length,
      share: yearAll.total ? (total / yearAll.total) * 100 : 0,
      yearRevenue: yearAll.total
    }
  }
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export function getActivityPage({ page = 1, pageSize = 50, action = null } = {}) {
  const offset = Math.max(0, (page - 1) * pageSize)
  const params = []
  let where = ''
  if (action && action !== 'all') {
    where = 'WHERE action = ?'
    params.push(action)
  }
  const rows = getDB().prepare(`
    SELECT * FROM activity_log
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)
  const total = getDB().prepare(`SELECT COUNT(*) AS c FROM activity_log ${where}`).get(...params).c
  return { rows, total, page, pageSize }
}

export function clearActivityLog() {
  getDB().prepare('DELETE FROM activity_log').run()
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export function exportAllData() {
  const d = getDB()
  return {
    customers:    d.prepare('SELECT * FROM customers').all(),
    transactions: d.prepare('SELECT * FROM transactions').all(),
    exportedAt:   new Date().toISOString()
  }
}

export function importData(data) {
  const d = getDB()
  const run = d.transaction(() => {
    d.prepare('DELETE FROM transactions').run()
    d.prepare('DELETE FROM customers').run()
    d.prepare('DELETE FROM activity_log').run()
    try {
      d.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='customers'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='activity_log'").run()
    } catch (_) {}
    const ic = d.prepare('INSERT INTO customers (id,full_name,email,phone,notes,created_at) VALUES (?,?,?,?,?,?)')
    for (const c of data.customers) {
      ic.run(c.id, c.full_name, c.email || null, c.phone || null, c.notes || null, c.created_at)
    }
    const it = d.prepare('INSERT INTO transactions (id,customer_id,amount,description,date,created_at) VALUES (?,?,?,?,?,?)')
    for (const t of data.transactions) {
      it.run(t.id, t.customer_id, t.amount, t.description || null, t.date, t.created_at)
    }
  })
  run()
}

export function clearAllData() {
  const d = getDB()
  const run = d.transaction(() => {
    d.prepare('DELETE FROM transactions').run()
    d.prepare('DELETE FROM customers').run()
    d.prepare('DELETE FROM activity_log').run()
    try {
      d.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='customers'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='activity_log'").run()
    } catch (_) {}
  })
  run()
}
