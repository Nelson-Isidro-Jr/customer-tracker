import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db

// Who is making changes (the profile name) and the current pesos-per-point
// rate. Both live in settings.json, so the main process pushes them in here.
let actor = null
let pesosPerPoint = 10000

export function setActor(name) { actor = name || null }
export function setPointsRate(rate) {
  const n = Number(rate)
  pesosPerPoint = Number.isFinite(n) && n > 0 ? n : 10000
}
export function getPointsRate() { return pesosPerPoint }

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
    CREATE INDEX IF NOT EXISTS idx_transactions_date_id     ON transactions(date, id);
    CREATE INDEX IF NOT EXISTS idx_transactions_cust_stats  ON transactions(customer_id, amount, date);
    CREATE INDEX IF NOT EXISTS idx_customers_name           ON customers(full_name COLLATE NOCASE);

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
    CREATE INDEX IF NOT EXISTS idx_activity_log_entity     ON activity_log(entity_type);

    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      points_cost INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      prize_id INTEGER,
      prize_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      points_spent INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON redemptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_created  ON redemptions(created_at);

    CREATE TABLE IF NOT EXISTS point_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_point_adjustments_customer ON point_adjustments(customer_id);
  `)

  // Columns added after 1.3.0. ALTER TABLE only when missing so existing
  // databases upgrade in place on first launch.
  const cols = db.prepare('PRAGMA table_info(activity_log)').all().map(c => c.name)
  if (!cols.includes('details')) db.exec('ALTER TABLE activity_log ADD COLUMN details TEXT')
  if (!cols.includes('actor'))   db.exec('ALTER TABLE activity_log ADD COLUMN actor TEXT')
}

export function logActivity({ action, entity_type, entity_id = null, customer_name = null, summary = null, amount = null, details = null }) {
  try {
    getDB().prepare(`
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, summary, amount, details, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(action, entity_type, entity_id, customer_name, summary, amount, details ? JSON.stringify(details) : null, actor)
  } catch (err) {
    console.error('[activity_log] insert failed:', err)
  }
}

// Field-level before/after list for edit events. Values are compared as
// normalized strings so null, '' and undefined count as the same "empty".
function changesBetween(before, after, fields) {
  const norm = v => (v === null || v === undefined ? '' : String(v))
  return fields
    .filter(([key]) => norm(before[key]) !== norm(after[key]))
    .map(([key, label, type = 'text']) => ({ field: label, type, from: before[key] ?? null, to: after[key] ?? null }))
}

function pageArgs(page, pageSize, max = 200) {
  const size = Math.min(max, Math.max(1, Number(pageSize) || 50))
  const p = Math.max(1, Number(page) || 1)
  return { page: p, pageSize: size, offset: (p - 1) * size }
}

const likeOf = q => `%${String(q).trim()}%`

// ─── Customer aggregates ──────────────────────────────────────────────────────

// Spend, visit count, last purchase, and points for every customer in one pass
// over idx_transactions_cust_stats. Points are always derived from the current
// rate, so changing it recalculates every existing balance.
const CUSTOMER_STATS_JOIN = `
  LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total, COUNT(*) AS cnt, MAX(date) AS last
    FROM transactions GROUP BY customer_id
  ) s ON s.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(points_spent) AS spent FROM redemptions GROUP BY customer_id
  ) r ON r.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(points) AS adj FROM point_adjustments GROUP BY customer_id
  ) a ON a.customer_id = c.id`

const POINTS_EARNED = 'CAST(ROUND(COALESCE(s.total, 0), 2) / @rate AS INTEGER)'

const CUSTOMER_COLUMNS = `
  c.*,
  COALESCE(s.total, 0)  AS total_purchases,
  COALESCE(s.cnt, 0)    AS transaction_count,
  s.last                AS last_purchase,
  ${POINTS_EARNED}      AS points_earned,
  COALESCE(a.adj, 0)    AS points_adjusted,
  COALESCE(r.spent, 0)  AS points_redeemed,
  ${POINTS_EARNED} + COALESCE(a.adj, 0) - COALESCE(r.spent, 0) AS points_balance`

const CUSTOMER_SORTS = {
  total:   'total_purchases DESC, c.id DESC',
  name:    'c.full_name COLLATE NOCASE ASC',
  recent:  'last_purchase IS NULL, last_purchase DESC, c.id DESC',
  points:  'points_balance DESC, total_purchases DESC',
  visits:  'transaction_count DESC, total_purchases DESC',
  newest:  'c.created_at DESC, c.id DESC'
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function getAllCustomers() {
  return getDB().prepare(`
    SELECT ${CUSTOMER_COLUMNS}
    FROM customers c ${CUSTOMER_STATS_JOIN}
    ORDER BY total_purchases DESC
  `).all({ rate: pesosPerPoint })
}

export function getAllCustomersLite() {
  return getDB().prepare(`SELECT id, full_name FROM customers ORDER BY full_name`).all()
}

export function getCustomersPage({ page, pageSize, search = '', sort = 'total' } = {}) {
  const d = getDB()
  const p = pageArgs(page, pageSize)
  const params = { rate: pesosPerPoint, limit: p.pageSize, offset: p.offset }
  let where = ''
  if (search && search.trim()) {
    where = 'WHERE c.full_name LIKE @q OR c.email LIKE @q OR c.phone LIKE @q'
    params.q = likeOf(search)
  }
  const order = CUSTOMER_SORTS[sort] || CUSTOMER_SORTS.total
  const rows = d.prepare(`
    SELECT ${CUSTOMER_COLUMNS}
    FROM customers c ${CUSTOMER_STATS_JOIN}
    ${where}
    ORDER BY ${order}
    LIMIT @limit OFFSET @offset
  `).all(params)
  const countParams = params.q ? { q: params.q } : {}
  const total = d.prepare(`SELECT COUNT(*) AS n FROM customers c ${where}`).get(countParams).n
  return { rows, total, page: p.page, pageSize: p.pageSize }
}

export function getCustomerSummary() {
  const d = getDB()
  const count = d.prepare('SELECT COUNT(*) AS n FROM customers').get().n
  const topBuyer = d.prepare(`
    SELECT c.id, c.full_name, SUM(t.amount) AS total_purchases
    FROM transactions t JOIN customers c ON c.id = t.customer_id
    GROUP BY c.id ORDER BY total_purchases DESC LIMIT 1
  `).get() || null
  const mostFrequent = d.prepare(`
    SELECT c.id, c.full_name, COUNT(t.id) AS transaction_count
    FROM transactions t JOIN customers c ON c.id = t.customer_id
    GROUP BY c.id ORDER BY transaction_count DESC, SUM(t.amount) DESC LIMIT 1
  `).get() || null
  return { count, topBuyer, mostFrequent }
}

// Small, fast lookup for pickers: matches name, email, or phone and returns
// at most `limit` rows, so even huge customer lists stay instant.
export function searchCustomersLite(query = '', limit = 30) {
  const params = { rate: pesosPerPoint, limit: Math.min(100, Math.max(1, limit)) }
  let where = ''
  if (query && query.trim()) {
    where = 'WHERE c.full_name LIKE @q OR c.email LIKE @q OR c.phone LIKE @q'
    params.q = likeOf(query)
  }
  return getDB().prepare(`
    SELECT c.id, c.full_name, c.email, c.phone,
           COALESCE(s.total, 0) AS total_purchases,
           ${POINTS_EARNED} + COALESCE(a.adj, 0) - COALESCE(r.spent, 0) AS points_balance
    FROM customers c ${CUSTOMER_STATS_JOIN}
    ${where}
    ORDER BY c.full_name COLLATE NOCASE
    LIMIT @limit
  `).all(params)
}

export function getCustomerById(id) {
  return getDB().prepare(`
    SELECT c.*,
           COALESCE(s.total, 0) AS total_purchases,
           COALESCE(s.cnt, 0)   AS transaction_count,
           s.last               AS last_purchase,
           ${POINTS_EARNED}     AS points_earned,
           COALESCE(a.adj, 0)   AS points_adjusted,
           COALESCE(r.spent, 0) AS points_redeemed,
           ${POINTS_EARNED} + COALESCE(a.adj, 0) - COALESCE(r.spent, 0) AS points_balance
    FROM customers c
    LEFT JOIN (SELECT customer_id, SUM(amount) AS total, COUNT(*) AS cnt, MAX(date) AS last
               FROM transactions WHERE customer_id = @id GROUP BY customer_id) s ON s.customer_id = c.id
    LEFT JOIN (SELECT customer_id, SUM(points_spent) AS spent
               FROM redemptions WHERE customer_id = @id GROUP BY customer_id) r ON r.customer_id = c.id
    LEFT JOIN (SELECT customer_id, SUM(points) AS adj
               FROM point_adjustments WHERE customer_id = @id GROUP BY customer_id) a ON a.customer_id = c.id
    WHERE c.id = @id
  `).get({ id: Number(id), rate: pesosPerPoint })
}

const CUSTOMER_FIELDS = [
  ['full_name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['notes', 'Notes']
]

export function addCustomer(data) {
  const result = getDB().prepare(`
    INSERT INTO customers (full_name, email, phone, notes) VALUES (?, ?, ?, ?)
  `).run(data.full_name, data.email || null, data.phone || null, data.notes || null)
  logActivity({
    action: 'customer_added',
    entity_type: 'customer',
    entity_id: result.lastInsertRowid,
    customer_name: data.full_name,
    summary: `Added customer ${data.full_name}`,
    details: { changes: changesBetween({}, data, CUSTOMER_FIELDS) }
  })
  return getCustomerById(result.lastInsertRowid)
}

export function updateCustomer(id, data) {
  const before = getDB().prepare('SELECT * FROM customers WHERE id = ?').get(id) || {}
  getDB().prepare(`
    UPDATE customers SET full_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?
  `).run(data.full_name, data.email || null, data.phone || null, data.notes || null, id)
  const changes = changesBetween(before, data, CUSTOMER_FIELDS)
  if (changes.length) {
    logActivity({
      action: 'customer_edited',
      entity_type: 'customer',
      entity_id: id,
      customer_name: data.full_name,
      summary: `Edited customer ${data.full_name}`,
      details: { changes }
    })
  }
  return getCustomerById(id)
}

export function deleteCustomer(id) {
  const d = getDB()
  const existing = d.prepare('SELECT full_name FROM customers WHERE id = ?').get(id)
  const stats = d.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE customer_id = ?').get(id)
  d.prepare('DELETE FROM customers WHERE id = ?').run(id)
  if (existing) {
    logActivity({
      action: 'customer_deleted',
      entity_type: 'customer',
      entity_id: id,
      customer_name: existing.full_name,
      summary: `Deleted customer ${existing.full_name} and ${stats.n} transaction${stats.n === 1 ? '' : 's'}`,
      amount: stats.total || null
    })
  }
}

export function searchCustomers(query) {
  return getDB().prepare(`
    SELECT ${CUSTOMER_COLUMNS}
    FROM customers c ${CUSTOMER_STATS_JOIN}
    WHERE c.full_name LIKE @q OR c.email LIKE @q OR c.phone LIKE @q
    ORDER BY total_purchases DESC
  `).all({ rate: pesosPerPoint, q: likeOf(query) })
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

// One page of the ledger plus the count and peso total of everything that
// matches, so the table only ever renders pageSize rows.
export function getTransactionsPage({ page, pageSize, search = '', startDate = '', endDate = '', customerId = null } = {}) {
  const d = getDB()
  const p = pageArgs(page, pageSize)
  const where = []
  const params = {}
  if (startDate)  { where.push('t.date >= @start'); params.start = startDate }
  if (endDate)    { where.push('t.date <= @end');   params.end = endDate }
  if (customerId) { where.push('t.customer_id = @cid'); params.cid = Number(customerId) }
  if (search && search.trim()) {
    where.push('(c.full_name LIKE @q OR t.description LIKE @q)')
    params.q = likeOf(search)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = d.prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${whereSql}
    ORDER BY t.date DESC, t.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: p.pageSize, offset: p.offset })
  const agg = d.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${whereSql}
  `).get(params)
  return { rows, total: agg.n, sum: agg.total, page: p.page, pageSize: p.pageSize }
}

export function getRecentTransactions(limit = 10) {
  return getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?
  `).all(Math.min(100, Math.max(1, limit)))
}

const TRANSACTION_FIELDS = [
  ['amount', 'Amount', 'money'],
  ['date', 'Date', 'date'],
  ['description', 'Description']
]

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
    amount: data.amount,
    details: { changes: changesBetween({}, data, TRANSACTION_FIELDS) }
  })
  return { id: result.lastInsertRowid, ...data }
}

export function updateTransaction(id, data) {
  const before = getDB().prepare('SELECT * FROM transactions WHERE id = ?').get(id) || {}
  getDB().prepare(`
    UPDATE transactions SET amount = ?, description = ?, date = ? WHERE id = ?
  `).run(data.amount, data.description || null, data.date, id)
  const row = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(id)
  const changes = changesBetween(before, data, TRANSACTION_FIELDS)
  if (row && changes.length) {
    logActivity({
      action: 'transaction_edited',
      entity_type: 'transaction',
      entity_id: id,
      customer_name: row.customer_name,
      summary: data.description || null,
      amount: data.amount,
      details: { changes }
    })
  }
  return row
}

export function deleteTransaction(id) {
  const existing = getDB().prepare(`
    SELECT t.amount, t.description, t.date, c.full_name AS customer_name
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
      amount: existing.amount,
      details: { changes: changesBetween(existing, {}, TRANSACTION_FIELDS) }
    })
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getDashboardStats() {
  const d = getDB()
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return {
    totalRevenue:      d.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM transactions').get().v,
    totalCustomers:    d.prepare('SELECT COUNT(*) AS v FROM customers').get().v,
    totalTransactions: d.prepare('SELECT COUNT(*) AS v FROM transactions').get().v,
    monthlyRevenue:    d.prepare(`SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE date BETWEEN ? AND ?`).get(`${ym}-01`, `${ym}-31`).v
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
    WHERE t.date BETWEEN ? AND ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(`${ym}-01`, `${ym}-31`)
}

export function getBestBuyerYearly(year) {
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(`${year}-01-01`, `${year}-12-31`)
}

export function getMonthlyRevenue(year) {
  return getDB().prepare(`
    SELECT strftime('%m', date) AS month,
           SUM(amount)          AS total,
           COUNT(*)             AS count
    FROM transactions
    WHERE date BETWEEN ? AND ?
    GROUP BY month ORDER BY month
  `).all(`${year}-01-01`, `${year}-12-31`)
}

export function getTopBuyers(year, month, limit = 5) {
  let where = ''
  const params = []
  if (year && month) {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    where = 'WHERE t.date BETWEEN ? AND ?'
    params.push(`${ym}-01`, `${ym}-31`)
  } else if (year) {
    where = 'WHERE t.date BETWEEN ? AND ?'
    params.push(`${year}-01-01`, `${year}-12-31`)
  }
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${where}
    GROUP BY c.id ORDER BY total_amount DESC LIMIT ?
  `).all(...params, Math.min(100, Math.max(1, Number(limit) || 5)))
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
  const range = [`${ym}-01`, `${ym}-31`]
  const transactions = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    ORDER BY t.date DESC, t.created_at DESC
  `).all(...range)
  const total = transactions.reduce((s, t) => s + t.amount, 0)
  const bestBuyer = getBestBuyerMonthly(year, month)
  const dailyBreakdown = getDB().prepare(`
    SELECT date, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    WHERE date BETWEEN ? AND ?
    GROUP BY date ORDER BY date
  `).all(...range)
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

  // Same customers ranked by how often they bought, not how much
  const frequentBuyers = d.prepare(`
    SELECT c.id, c.full_name, c.email, c.phone,
           COUNT(t.id)   AS transaction_count,
           SUM(t.amount) AS total_amount,
           MAX(t.date)   AS last_purchase,
           COUNT(DISTINCT strftime('%m', t.date)) AS active_months
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date BETWEEN ? AND ?
    GROUP BY c.id ORDER BY transaction_count DESC, total_amount DESC LIMIT ?
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
    frequentBuyers: frequentBuyers.map(b => ({
      ...b,
      average: b.transaction_count ? b.total_amount / b.transaction_count : 0,
      share: totals.count ? (b.transaction_count / totals.count) * 100 : 0
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

// ─── Rewards ──────────────────────────────────────────────────────────────────

const PRIZE_FIELDS = [
  ['name', 'Prize'],
  ['description', 'Description'],
  ['points_cost', 'Points cost', 'number'],
  ['quantity', 'Quantity', 'number']
]

function cleanPrize(data) {
  const name = String(data.name || '').trim()
  const cost = Math.round(Number(data.points_cost))
  const qty = Math.round(Number(data.quantity))
  if (!name) throw new Error('Prize name is required')
  if (!Number.isFinite(cost) || cost < 1) throw new Error('Points cost must be at least 1')
  if (!Number.isFinite(qty) || qty < 0) throw new Error('Quantity cannot be negative')
  return { name, description: String(data.description || '').trim() || null, points_cost: cost, quantity: qty }
}

export function getPrizes() {
  return getDB().prepare(`
    SELECT p.*, COALESCE(SUM(r.quantity), 0) AS claimed
    FROM prizes p
    LEFT JOIN redemptions r ON r.prize_id = p.id
    GROUP BY p.id
    ORDER BY p.points_cost ASC, p.name COLLATE NOCASE
  `).all()
}

export function addPrize(data) {
  const prize = cleanPrize(data)
  const result = getDB().prepare(`
    INSERT INTO prizes (name, description, points_cost, quantity) VALUES (@name, @description, @points_cost, @quantity)
  `).run(prize)
  logActivity({
    action: 'prize_added',
    entity_type: 'prize',
    entity_id: result.lastInsertRowid,
    summary: `Added prize ${prize.name} (${prize.points_cost} pts, ${prize.quantity} in stock)`,
    details: { changes: changesBetween({}, prize, PRIZE_FIELDS) }
  })
  return getDB().prepare('SELECT * FROM prizes WHERE id = ?').get(result.lastInsertRowid)
}

export function updatePrize(id, data) {
  const before = getDB().prepare('SELECT * FROM prizes WHERE id = ?').get(id)
  if (!before) throw new Error('Prize not found')
  const prize = cleanPrize(data)
  getDB().prepare(`
    UPDATE prizes SET name = @name, description = @description, points_cost = @points_cost,
                      quantity = @quantity, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...prize, id })
  const changes = changesBetween(before, prize, PRIZE_FIELDS)
  if (changes.length) {
    logActivity({
      action: 'prize_edited',
      entity_type: 'prize',
      entity_id: id,
      summary: `Edited prize ${prize.name}`,
      details: { changes }
    })
  }
  return getDB().prepare('SELECT * FROM prizes WHERE id = ?').get(id)
}

export function deletePrize(id) {
  const before = getDB().prepare('SELECT * FROM prizes WHERE id = ?').get(id)
  if (!before) return
  getDB().prepare('DELETE FROM prizes WHERE id = ?').run(id)
  logActivity({
    action: 'prize_deleted',
    entity_type: 'prize',
    entity_id: id,
    summary: `Deleted prize ${before.name}`,
    details: { changes: changesBetween(before, {}, PRIZE_FIELDS) }
  })
}

export function getCustomerPoints(customerId) {
  const c = getCustomerById(customerId)
  if (!c) throw new Error('Customer not found')
  const cents = Math.round(c.total_purchases * 100)
  const spendTowardNext = (Math.round(pesosPerPoint * 100) - (cents % Math.round(pesosPerPoint * 100))) / 100
  return {
    customerId: c.id,
    full_name: c.full_name,
    total_purchases: c.total_purchases,
    earned: c.points_earned,
    adjusted: c.points_adjusted,
    redeemed: c.points_redeemed,
    balance: c.points_balance,
    rate: pesosPerPoint,
    toNextPoint: spendTowardNext
  }
}

// Claims a prize: re-checks stock and the live balance inside one SQLite
// transaction, then records the redemption and takes the item out of stock.
export function redeemPrize({ customerId, prizeId, quantity = 1 }) {
  const d = getDB()
  const qty = Math.max(1, Math.round(Number(quantity) || 1))
  const run = d.transaction(() => {
    const prize = d.prepare('SELECT * FROM prizes WHERE id = ?').get(prizeId)
    if (!prize) throw new Error('Prize not found')
    if (prize.quantity < qty) throw new Error(`Only ${prize.quantity} left in stock`)
    const points = getCustomerPoints(customerId)
    const cost = prize.points_cost * qty
    if (points.balance < cost) throw new Error(`Not enough points: needs ${cost}, has ${points.balance}`)
    const result = d.prepare(`
      INSERT INTO redemptions (customer_id, prize_id, prize_name, quantity, points_spent) VALUES (?, ?, ?, ?, ?)
    `).run(customerId, prize.id, prize.name, qty, cost)
    d.prepare('UPDATE prizes SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, prize.id)
    logActivity({
      action: 'reward_redeemed',
      entity_type: 'redemption',
      entity_id: result.lastInsertRowid,
      customer_name: points.full_name,
      summary: `Claimed ${qty > 1 ? `${qty} × ` : ''}${prize.name} for ${cost} points`,
      details: {
        changes: [
          { field: 'Points balance', type: 'number', from: points.balance, to: points.balance - cost },
          { field: `${prize.name} stock`, type: 'number', from: prize.quantity, to: prize.quantity - qty }
        ]
      }
    })
    return result.lastInsertRowid
  })
  run()
  return { points: getCustomerPoints(customerId), prize: d.prepare('SELECT * FROM prizes WHERE id = ?').get(prizeId) }
}

// Undoes a claim: points come back to the customer and, if the prize still
// exists, the items go back into stock.
export function cancelRedemption(id) {
  const d = getDB()
  const run = d.transaction(() => {
    const r = d.prepare(`
      SELECT r.*, c.full_name FROM redemptions r JOIN customers c ON c.id = r.customer_id WHERE r.id = ?
    `).get(id)
    if (!r) throw new Error('Redemption not found')
    d.prepare('DELETE FROM redemptions WHERE id = ?').run(id)
    if (r.prize_id) d.prepare('UPDATE prizes SET quantity = quantity + ? WHERE id = ?').run(r.quantity, r.prize_id)
    logActivity({
      action: 'reward_cancelled',
      entity_type: 'redemption',
      entity_id: id,
      customer_name: r.full_name,
      summary: `Cancelled claim of ${r.quantity > 1 ? `${r.quantity} × ` : ''}${r.prize_name}; ${r.points_spent} points returned`
    })
  })
  run()
}

export function adjustPoints({ customerId, points, reason = '' }) {
  const delta = Math.round(Number(points))
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Enter a non-zero number of points')
  const before = getCustomerPoints(customerId)
  if (before.balance + delta < 0) throw new Error(`Cannot deduct more than the current balance (${before.balance} points)`)
  const note = String(reason || '').trim() || null
  const result = getDB().prepare(`
    INSERT INTO point_adjustments (customer_id, points, reason) VALUES (?, ?, ?)
  `).run(customerId, delta, note)
  logActivity({
    action: delta > 0 ? 'points_added' : 'points_deducted',
    entity_type: 'redemption',
    entity_id: result.lastInsertRowid,
    customer_name: before.full_name,
    summary: `${delta > 0 ? 'Added' : 'Deducted'} ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'}${note ? ` — ${note}` : ''}`,
    details: { changes: [{ field: 'Points balance', type: 'number', from: before.balance, to: before.balance + delta }] }
  })
  return getCustomerPoints(customerId)
}

// Everything that moved a customer's points other than purchases: claims,
// cancellations are reflected by removal, and manual adjustments.
export function getPointsHistory(customerId, limit = 50) {
  return getDB().prepare(`
    SELECT 'redemption' AS kind, id, -points_spent AS points, prize_name AS label, quantity, created_at
    FROM redemptions WHERE customer_id = @id
    UNION ALL
    SELECT 'adjustment' AS kind, id, points, COALESCE(reason, '') AS label, NULL AS quantity, created_at
    FROM point_adjustments WHERE customer_id = @id
    ORDER BY created_at DESC, id DESC
    LIMIT @limit
  `).all({ id: Number(customerId), limit: Math.min(200, Math.max(1, limit)) })
}

export function getPointsPage({ page, pageSize, search = '' } = {}) {
  return getCustomersPage({ page, pageSize, search, sort: 'points' })
}

export function getRedemptionsPage({ page, pageSize, search = '' } = {}) {
  const d = getDB()
  const p = pageArgs(page, pageSize)
  const params = {}
  let where = ''
  if (search && search.trim()) {
    where = 'WHERE c.full_name LIKE @q OR r.prize_name LIKE @q'
    params.q = likeOf(search)
  }
  const rows = d.prepare(`
    SELECT r.*, c.full_name AS customer_name
    FROM redemptions r JOIN customers c ON c.id = r.customer_id
    ${where}
    ORDER BY r.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: p.pageSize, offset: p.offset })
  const total = d.prepare(`
    SELECT COUNT(*) AS n FROM redemptions r JOIN customers c ON c.id = r.customer_id ${where}
  `).get(params).n
  return { rows, total, page: p.page, pageSize: p.pageSize }
}

export function getRewardsSummary() {
  const d = getDB()
  const outstanding = d.prepare(`
    SELECT COALESCE(SUM(MAX(${POINTS_EARNED} + COALESCE(a.adj, 0) - COALESCE(r.spent, 0), 0)), 0) AS n
    FROM customers c ${CUSTOMER_STATS_JOIN}
  `).get({ rate: pesosPerPoint }).n
  const redeemed = d.prepare('SELECT COALESCE(SUM(points_spent), 0) AS pts, COUNT(*) AS n FROM redemptions').get()
  const stock = d.prepare('SELECT COUNT(*) AS prizes, COALESCE(SUM(quantity), 0) AS items FROM prizes').get()
  return {
    rate: pesosPerPoint,
    outstandingPoints: outstanding,
    redeemedPoints: redeemed.pts,
    redemptions: redeemed.n,
    prizeCount: stock.prizes,
    itemsInStock: stock.items
  }
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

const LOG_CATEGORIES = {
  customers:    ['customer'],
  transactions: ['transaction'],
  rewards:      ['prize', 'redemption'],
  settings:     ['settings'],
  data:         ['data']
}

export function getActivityPage({ page, pageSize, action = null, category = 'all', search = '', from = '', to = '' } = {}) {
  const d = getDB()
  const p = pageArgs(page, pageSize)
  const where = []
  const params = {}
  if (action && action !== 'all') { where.push('action = @action'); params.action = action }
  if (category && LOG_CATEGORIES[category]) {
    where.push(`entity_type IN (${LOG_CATEGORIES[category].map((_, i) => `@cat${i}`).join(', ')})`)
    LOG_CATEGORIES[category].forEach((c, i) => { params[`cat${i}`] = c })
  }
  if (search && search.trim()) {
    where.push('(customer_name LIKE @q OR summary LIKE @q OR actor LIKE @q OR details LIKE @q)')
    params.q = likeOf(search)
  }
  // created_at is UTC; turn the local calendar days into UTC bounds
  const utc = (day, time) => new Date(`${day}T${time}`).toISOString().replace('T', ' ').slice(0, 19)
  if (from) { where.push('created_at >= @from'); params.from = utc(from, '00:00:00') }
  if (to)   { where.push('created_at <= @to');   params.to = utc(to, '23:59:59') }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = d.prepare(`
    SELECT * FROM activity_log
    ${whereSql}
    ORDER BY id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: p.pageSize, offset: p.offset }).map(r => {
    let details = null
    try { details = r.details ? JSON.parse(r.details) : null } catch (_) {}
    return { ...r, details }
  })
  const total = d.prepare(`SELECT COUNT(*) AS c FROM activity_log ${whereSql}`).get(params).c
  return { rows, total, page: p.page, pageSize: p.pageSize }
}

export function getActivityCounts() {
  const rows = getDB().prepare('SELECT entity_type, COUNT(*) AS n FROM activity_log GROUP BY entity_type').all()
  const counts = { all: 0 }
  Object.keys(LOG_CATEGORIES).forEach(k => { counts[k] = 0 })
  rows.forEach(r => {
    counts.all += r.n
    const cat = Object.keys(LOG_CATEGORIES).find(k => LOG_CATEGORIES[k].includes(r.entity_type))
    if (cat) counts[cat] += r.n
  })
  return counts
}

export function clearActivityLog() {
  getDB().prepare('DELETE FROM activity_log').run()
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export function exportAllData() {
  const d = getDB()
  return {
    customers:         d.prepare('SELECT * FROM customers').all(),
    transactions:      d.prepare('SELECT * FROM transactions').all(),
    prizes:            d.prepare('SELECT * FROM prizes').all(),
    redemptions:       d.prepare('SELECT * FROM redemptions').all(),
    point_adjustments: d.prepare('SELECT * FROM point_adjustments').all(),
    exportedAt:        new Date().toISOString()
  }
}

function wipeData(d) {
  for (const table of ['redemptions', 'point_adjustments', 'transactions', 'customers', 'prizes']) {
    d.prepare(`DELETE FROM ${table}`).run()
    try { d.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table) } catch (_) {}
  }
}

// Replaces customers, transactions, and rewards with the backup. The activity
// log is kept (it is the audit trail) and records the import itself.
export function importData(data) {
  const d = getDB()
  const customers = Array.isArray(data?.customers) ? data.customers : null
  const transactions = Array.isArray(data?.transactions) ? data.transactions : null
  if (!customers || !transactions) throw new Error('This file is not a Customer Tracker backup')
  const run = d.transaction(() => {
    wipeData(d)
    const ic = d.prepare('INSERT INTO customers (id,full_name,email,phone,notes,created_at) VALUES (?,?,?,?,?,?)')
    for (const c of customers) {
      ic.run(c.id, c.full_name, c.email || null, c.phone || null, c.notes || null, c.created_at)
    }
    const it = d.prepare('INSERT INTO transactions (id,customer_id,amount,description,date,created_at) VALUES (?,?,?,?,?,?)')
    for (const t of transactions) {
      it.run(t.id, t.customer_id, t.amount, t.description || null, t.date, t.created_at)
    }
    const ip = d.prepare('INSERT INTO prizes (id,name,description,points_cost,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    for (const p of data.prizes || []) {
      ip.run(p.id, p.name, p.description || null, p.points_cost, p.quantity, p.created_at, p.updated_at || p.created_at)
    }
    const ir = d.prepare('INSERT INTO redemptions (id,customer_id,prize_id,prize_name,quantity,points_spent,created_at) VALUES (?,?,?,?,?,?,?)')
    for (const r of data.redemptions || []) {
      ir.run(r.id, r.customer_id, r.prize_id ?? null, r.prize_name, r.quantity || 1, r.points_spent, r.created_at)
    }
    const ia = d.prepare('INSERT INTO point_adjustments (id,customer_id,points,reason,created_at) VALUES (?,?,?,?,?)')
    for (const a of data.point_adjustments || []) {
      ia.run(a.id, a.customer_id, a.points, a.reason || null, a.created_at)
    }
    logActivity({
      action: 'data_imported',
      entity_type: 'data',
      summary: `Imported backup: ${customers.length} customers, ${transactions.length} transactions, ${(data.prizes || []).length} prizes`
    })
  })
  run()
}

export function clearAllData() {
  const d = getDB()
  const run = d.transaction(() => {
    const counts = {
      customers: d.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
      transactions: d.prepare('SELECT COUNT(*) AS n FROM transactions').get().n,
      prizes: d.prepare('SELECT COUNT(*) AS n FROM prizes').get().n
    }
    wipeData(d)
    logActivity({
      action: 'data_cleared',
      entity_type: 'data',
      summary: `Cleared all data: ${counts.customers} customers, ${counts.transactions} transactions, ${counts.prizes} prizes`
    })
  })
  run()
}
