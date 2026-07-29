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
    CREATE INDEX IF NOT EXISTS idx_transactions_date_id     ON transactions(date DESC, id DESC);

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

    CREATE TABLE IF NOT EXISTS points_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      peso_per_point REAL NOT NULL DEFAULT 10000,
      start_date DATE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO points_config (id, peso_per_point, start_date) VALUES (1, 10000, NULL);

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      points_cost INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      reward_id INTEGER,
      customer_name TEXT NOT NULL,
      reward_name TEXT NOT NULL,
      points_spent INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id)   REFERENCES rewards(id)   ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON redemptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_created  ON redemptions(created_at);
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

export function getCustomersPage(opts = {}) {
  const page     = Math.max(1, opts.page || 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize || 50))
  const offset   = (page - 1) * pageSize
  const q        = (opts.search || '').trim()

  const where  = q ? 'WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?' : ''
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []

  const rows = getDB().prepare(`
    SELECT c.*,
           COALESCE(SUM(t.amount), 0) AS total_purchases,
           COUNT(t.id)                AS transaction_count,
           MAX(t.date)                AS last_purchase
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
    ${where}
    GROUP BY c.id
    ORDER BY total_purchases DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  const total = getDB().prepare(`SELECT COUNT(*) AS c FROM customers c ${where}`).get(...params).c
  return { rows, total, page, pageSize }
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

// Builds the shared WHERE clause for the paginated transaction queries.
function txnFilterClause({ search, startDate, endDate, customerId }) {
  const clauses = []
  const params = []
  if (startDate)  { clauses.push('t.date >= ?');        params.push(startDate) }
  if (endDate)    { clauses.push('t.date <= ?');        params.push(endDate) }
  if (customerId) { clauses.push('t.customer_id = ?');  params.push(customerId) }
  const q = (search || '').trim()
  if (q) {
    const like = `%${q}%`
    clauses.push('(c.full_name LIKE ? OR t.description LIKE ?)')
    params.push(like, like)
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  }
}

export function getTransactionsPage(opts = {}) {
  const page     = Math.max(1, opts.page || 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize || 50))
  const offset   = (page - 1) * pageSize
  const { where, params } = txnFilterClause(opts)

  const rows = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${where}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  const totals = getDB().prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(t.amount), 0) AS sumAmount
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${where}
  `).get(...params)

  return { rows, total: totals.total, sumAmount: totals.sumAmount, page, pageSize }
}

export function getRecentTransactions(limit = 10) {
  const n = Math.min(100, Math.max(1, limit || 10))
  return getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?
  `).all(n)
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
//
// Date filters use half-open ranges (>= start, < end) rather than
// strftime('%Y-%m', date) = ?. A function call on the column makes the query
// unsargable, forcing a full table scan; plain comparisons on the 'YYYY-MM-DD'
// text let SQLite use idx_transactions_date.

const pad = (n) => String(n).padStart(2, '0')

function monthRange(year, month) {
  const y = Number(year), m = Number(month)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  return { start: `${y}-${pad(m)}-01`, end: `${nextY}-${pad(nextM)}-01` }
}

function yearRange(year) {
  const y = Number(year)
  return { start: `${y}-01-01`, end: `${y + 1}-01-01` }
}

export function getDashboardStats() {
  const d = getDB()
  const now = new Date()
  const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1)
  return {
    totalRevenue:      d.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM transactions').get().v,
    totalCustomers:    d.prepare('SELECT COUNT(*) AS v FROM customers').get().v,
    totalTransactions: d.prepare('SELECT COUNT(*) AS v FROM transactions').get().v,
    monthlyRevenue:    d.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM transactions WHERE date >= ? AND date < ?').get(start, end).v
  }
}

export function getBestBuyerMonthly(year, month) {
  const { start, end } = monthRange(year, month)
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date >= ? AND t.date < ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(start, end)
}

export function getBestBuyerYearly(year) {
  const { start, end } = yearRange(year)
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date >= ? AND t.date < ?
    GROUP BY c.id ORDER BY total_amount DESC LIMIT 1
  `).get(start, end)
}

export function getMonthlyRevenue(year) {
  const { start, end } = yearRange(year)
  return getDB().prepare(`
    SELECT strftime('%m', date) AS month,
           SUM(amount)          AS total,
           COUNT(*)             AS count
    FROM transactions
    WHERE date >= ? AND date < ?
    GROUP BY month ORDER BY month
  `).all(start, end)
}

export function getTopBuyers(year, month, limit = 5) {
  let where = ''
  const params = []
  if (year && month) {
    const { start, end } = monthRange(year, month)
    where = 'WHERE t.date >= ? AND t.date < ?'
    params.push(start, end)
  } else if (year) {
    const { start, end } = yearRange(year)
    where = 'WHERE t.date >= ? AND t.date < ?'
    params.push(start, end)
  }
  const n = Math.min(100, Math.max(1, parseInt(limit, 10) || 5))
  return getDB().prepare(`
    SELECT c.id, c.full_name,
           SUM(t.amount) AS total_amount,
           COUNT(t.id)   AS transaction_count
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    ${where}
    GROUP BY c.id ORDER BY total_amount DESC LIMIT ?
  `).all(...params, n)
}

// ─── Reports ──────────────────────────────────────────────────────────────────

// Totals only — the transaction list is fetched separately and paginated, so a
// busy month never ships thousands of rows across IPC just to show a table.
export function getDailyReportSummary(date) {
  const row = getDB().prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
    FROM transactions WHERE date = ?
  `).get(date)
  return { date, total: row.total, count: row.count }
}

export function getMonthlyReportSummary(year, month) {
  const { start, end } = monthRange(year, month)
  const row = getDB().prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
    FROM transactions WHERE date >= ? AND date < ?
  `).get(start, end)
  const dailyBreakdown = getDB().prepare(`
    SELECT date, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions WHERE date >= ? AND date < ?
    GROUP BY date ORDER BY date
  `).all(start, end)
  return {
    year,
    month: `${year}-${String(month).padStart(2, '0')}`,
    total: row.total,
    count: row.count,
    bestBuyer: getBestBuyerMonthly(year, month),
    dailyBreakdown
  }
}

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

// Full row dump — used by the Excel export, which genuinely needs every row.
export function getMonthlyReport(year, month) {
  const { start, end } = monthRange(year, month)
  const ym = `${year}-${pad(month)}`
  const transactions = getDB().prepare(`
    SELECT t.*, c.full_name AS customer_name
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.date >= ? AND t.date < ?
    ORDER BY t.date DESC, t.id DESC
  `).all(start, end)
  const total = transactions.reduce((s, t) => s + t.amount, 0)
  const bestBuyer = getBestBuyerMonthly(year, month)
  const dailyBreakdown = getDB().prepare(`
    SELECT date, SUM(amount) AS total, COUNT(*) AS count
    FROM transactions
    WHERE date >= ? AND date < ?
    GROUP BY date ORDER BY date
  `).all(start, end)
  return { year, month: ym, transactions, total, count: transactions.length, bestBuyer, dailyBreakdown }
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

// ─── Points & Rewards ─────────────────────────────────────────────────────────
//
// Points are never stored as a running total — they are derived on every read
// from the transactions table and the configured rate. Changing the rate or the
// start date therefore recalculates every balance instantly, with no migration
// pass and no chance of the stored value drifting from the transactions.

export function getPointsConfig() {
  return getDB().prepare('SELECT * FROM points_config WHERE id = 1').get()
}

export function setPointsConfig({ peso_per_point, start_date }) {
  const rate = Number(peso_per_point)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Pesos per point must be greater than zero')
  const start = start_date || null
  getDB().prepare(`
    UPDATE points_config
    SET peso_per_point = ?, start_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(rate, start)
  logActivity({
    action: 'points_config_changed',
    entity_type: 'points_config',
    entity_id: 1,
    summary: `Set ${formatRate(rate)} · ${start ? `earning from ${start}` : 'counting all transactions'}`
  })
  return getPointsConfig()
}

function formatRate(rate) {
  return `₱${rate.toLocaleString('en-PH')} = 1 point`
}

// The single expression every points read is built from. `?` params in order:
// rate, rate, startDate, startDate.
const POINTS_SELECT = `
  SELECT c.id, c.full_name,
         COALESCE(e.spend, 0)                                            AS qualifying_spend,
         CAST(COALESCE(e.spend, 0) / ? AS INTEGER)                       AS points_earned,
         COALESCE(r.spent, 0)                                            AS points_redeemed,
         CAST(COALESCE(e.spend, 0) / ? AS INTEGER) - COALESCE(r.spent, 0) AS points_balance
  FROM customers c
  LEFT JOIN (
    SELECT customer_id, SUM(amount) AS spend
    FROM transactions
    WHERE (? IS NULL OR date >= ?)
    GROUP BY customer_id
  ) e ON e.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, SUM(points_spent) AS spent
    FROM redemptions
    GROUP BY customer_id
  ) r ON r.customer_id = c.id
`

const POINTS_SORTS = {
  balance:  'points_balance DESC, c.full_name ASC',
  earned:   'points_earned DESC, c.full_name ASC',
  spend:    'qualifying_spend DESC, c.full_name ASC',
  name:     'c.full_name ASC'
}

export function getPointsBalancesPage(opts = {}) {
  const page     = Math.max(1, opts.page || 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize || 50))
  const offset   = (page - 1) * pageSize
  const orderBy  = POINTS_SORTS[opts.sort] || POINTS_SORTS.balance

  const cfg = getPointsConfig()
  const base = [cfg.peso_per_point, cfg.peso_per_point, cfg.start_date, cfg.start_date]

  const q = (opts.search || '').trim()
  const where  = q ? 'WHERE c.full_name LIKE ?' : ''
  const params = q ? [...base, `%${q}%`] : base

  const rows = getDB().prepare(`
    ${POINTS_SELECT}
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  const total = getDB().prepare(
    `SELECT COUNT(*) AS c FROM customers c ${q ? 'WHERE c.full_name LIKE ?' : ''}`
  ).get(...(q ? [`%${q}%`] : [])).c

  return { rows, total, page, pageSize, config: cfg }
}

export function getCustomerPoints(customerId) {
  const cfg = getPointsConfig()
  return getDB().prepare(`${POINTS_SELECT} WHERE c.id = ?`).get(
    cfg.peso_per_point, cfg.peso_per_point, cfg.start_date, cfg.start_date, customerId
  )
}

export function getPointsSummary() {
  const cfg = getPointsConfig()
  const row = getDB().prepare(`
    SELECT COUNT(*)                                    AS customers,
           COALESCE(SUM(qualifying_spend), 0)          AS qualifying_spend,
           COALESCE(SUM(points_earned), 0)             AS points_earned,
           COALESCE(SUM(points_redeemed), 0)           AS points_redeemed,
           COALESCE(SUM(MAX(points_balance, 0)), 0)    AS points_available,
           COALESCE(SUM(points_balance > 0), 0)        AS customers_with_points
    FROM (${POINTS_SELECT})
  `).get(cfg.peso_per_point, cfg.peso_per_point, cfg.start_date, cfg.start_date)
  return { ...row, config: cfg }
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export function getRewards() {
  return getDB().prepare('SELECT * FROM rewards ORDER BY active DESC, points_cost ASC, name ASC').all()
}

function validateReward(data) {
  const name = (data.name || '').trim()
  const cost = parseInt(data.points_cost, 10)
  const qty  = parseInt(data.quantity, 10)
  if (!name) throw new Error('Reward name is required')
  if (!Number.isFinite(cost) || cost <= 0) throw new Error('Points cost must be greater than zero')
  if (!Number.isFinite(qty) || qty < 0) throw new Error('Quantity cannot be negative')
  return { name, cost, qty }
}

export function addReward(data) {
  const { name, cost, qty } = validateReward(data)
  const result = getDB().prepare(`
    INSERT INTO rewards (name, description, points_cost, quantity, image, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, data.description || null, cost, qty, data.image || null, data.active === 0 ? 0 : 1)
  logActivity({
    action: 'reward_added',
    entity_type: 'reward',
    entity_id: result.lastInsertRowid,
    summary: `Added reward ${name} (${cost} pts, qty ${qty})`
  })
  return getDB().prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid)
}

export function updateReward(id, data) {
  const { name, cost, qty } = validateReward(data)
  getDB().prepare(`
    UPDATE rewards SET name = ?, description = ?, points_cost = ?, quantity = ?, image = ?, active = ?
    WHERE id = ?
  `).run(name, data.description || null, cost, qty, data.image || null, data.active === 0 ? 0 : 1, id)
  logActivity({
    action: 'reward_edited',
    entity_type: 'reward',
    entity_id: id,
    summary: `Edited reward ${name} (${cost} pts, qty ${qty})`
  })
  return getDB().prepare('SELECT * FROM rewards WHERE id = ?').get(id)
}

export function deleteReward(id) {
  const existing = getDB().prepare('SELECT name FROM rewards WHERE id = ?').get(id)
  getDB().prepare('DELETE FROM rewards WHERE id = ?').run(id)
  if (existing) {
    logActivity({
      action: 'reward_deleted',
      entity_type: 'reward',
      entity_id: id,
      summary: `Deleted reward ${existing.name}`
    })
  }
}

// ─── Redemptions ──────────────────────────────────────────────────────────────

export function redeemReward({ customer_id, reward_id, quantity = 1, note = null }) {
  const d = getDB()
  const qty = parseInt(quantity, 10)
  if (!Number.isFinite(qty) || qty < 1) throw new Error('Quantity must be at least 1')

  const run = d.transaction(() => {
    const customer = d.prepare('SELECT id, full_name FROM customers WHERE id = ?').get(customer_id)
    if (!customer) throw new Error('Customer not found')

    const reward = d.prepare('SELECT * FROM rewards WHERE id = ?').get(reward_id)
    if (!reward) throw new Error('Reward not found')
    if (!reward.active) throw new Error(`${reward.name} is not currently available`)
    if (reward.quantity < qty) {
      throw new Error(
        reward.quantity === 0
          ? `${reward.name} is out of stock`
          : `Only ${reward.quantity} of ${reward.name} left in stock`
      )
    }

    // Re-derive the balance inside the transaction — the UI's disabled state is
    // a convenience, this is the actual guard.
    const points = getCustomerPoints(customer_id)
    const cost = reward.points_cost * qty
    if (points.points_balance < cost) {
      throw new Error(`${customer.full_name} has ${points.points_balance} points — ${cost} needed`)
    }

    d.prepare('UPDATE rewards SET quantity = quantity - ? WHERE id = ?').run(qty, reward_id)
    const result = d.prepare(`
      INSERT INTO redemptions (customer_id, reward_id, customer_name, reward_name, points_spent, quantity, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, reward_id, customer.full_name, reward.name, cost, qty, note || null)

    return { id: result.lastInsertRowid, customer, reward, cost, qty }
  })

  const out = run()
  logActivity({
    action: 'reward_redeemed',
    entity_type: 'redemption',
    entity_id: out.id,
    customer_name: out.customer.full_name,
    summary: `Redeemed ${out.qty}× ${out.reward.name} for ${out.cost} points`
  })
  return getCustomerPoints(customer_id)
}

export function getRedemptionsPage(opts = {}) {
  const page     = Math.max(1, opts.page || 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize || 50))
  const offset   = (page - 1) * pageSize
  const params = []
  let where = ''
  if (opts.customerId) {
    where = 'WHERE customer_id = ?'
    params.push(opts.customerId)
  }
  const rows = getDB().prepare(`
    SELECT id, customer_id, reward_id, customer_name, reward_name, points_spent, quantity, note, created_at
    FROM redemptions
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)
  const total = getDB().prepare(`SELECT COUNT(*) AS c FROM redemptions ${where}`).get(...params).c
  return { rows, total, page, pageSize }
}

// Voids a claim: restores stock if the reward still exists. The points return
// on their own, since balances subtract from this table.
export function deleteRedemption(id) {
  const d = getDB()
  const run = d.transaction(() => {
    const existing = d.prepare('SELECT * FROM redemptions WHERE id = ?').get(id)
    if (!existing) throw new Error('Redemption not found')
    if (existing.reward_id) {
      d.prepare('UPDATE rewards SET quantity = quantity + ? WHERE id = ?').run(existing.quantity, existing.reward_id)
    }
    d.prepare('DELETE FROM redemptions WHERE id = ?').run(id)
    return existing
  })
  const existing = run()
  logActivity({
    action: 'redemption_voided',
    entity_type: 'redemption',
    entity_id: id,
    customer_name: existing.customer_name,
    summary: `Voided ${existing.quantity}× ${existing.reward_name} — ${existing.points_spent} points returned`
  })
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export function exportAllData() {
  const d = getDB()
  return {
    customers:    d.prepare('SELECT * FROM customers').all(),
    transactions: d.prepare('SELECT * FROM transactions').all(),
    rewards:      d.prepare('SELECT * FROM rewards').all(),
    redemptions:  d.prepare('SELECT * FROM redemptions').all(),
    pointsConfig: getPointsConfig(),
    exportedAt:   new Date().toISOString()
  }
}

const RESET_TABLES = ['redemptions', 'rewards', 'transactions', 'customers', 'activity_log']

function resetSequences(d, tables) {
  for (const t of tables) {
    try { d.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t) } catch (_) {}
  }
}

// Backups written before the points feature have no rewards/redemptions/config
// keys — treat them as empty rather than throwing.
export function importData(data) {
  const d = getDB()
  const run = d.transaction(() => {
    for (const t of RESET_TABLES) d.prepare(`DELETE FROM ${t}`).run()
    resetSequences(d, RESET_TABLES)

    const ic = d.prepare('INSERT INTO customers (id,full_name,email,phone,notes,created_at) VALUES (?,?,?,?,?,?)')
    for (const c of data.customers || []) {
      ic.run(c.id, c.full_name, c.email || null, c.phone || null, c.notes || null, c.created_at)
    }

    const it = d.prepare('INSERT INTO transactions (id,customer_id,amount,description,date,created_at) VALUES (?,?,?,?,?,?)')
    for (const t of data.transactions || []) {
      it.run(t.id, t.customer_id, t.amount, t.description || null, t.date, t.created_at)
    }

    const ir = d.prepare(`
      INSERT INTO rewards (id,name,description,points_cost,quantity,image,active,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `)
    for (const r of data.rewards || []) {
      ir.run(r.id, r.name, r.description || null, r.points_cost, r.quantity,
             r.image || null, r.active === 0 ? 0 : 1, r.created_at)
    }

    const ird = d.prepare(`
      INSERT INTO redemptions (id,customer_id,reward_id,customer_name,reward_name,points_spent,quantity,note,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    for (const r of data.redemptions || []) {
      ird.run(r.id, r.customer_id, r.reward_id || null, r.customer_name, r.reward_name,
              r.points_spent, r.quantity || 1, r.note || null, r.created_at)
    }

    const cfg = data.pointsConfig
    if (cfg && Number(cfg.peso_per_point) > 0) {
      d.prepare('UPDATE points_config SET peso_per_point = ?, start_date = ? WHERE id = 1')
        .run(Number(cfg.peso_per_point), cfg.start_date || null)
    }
  })
  run()
}

// Clears the customer records and everything hanging off them. The rewards
// catalog and the points rate are configuration, so they survive.
export function clearAllData() {
  const d = getDB()
  const tables = ['redemptions', 'transactions', 'customers', 'activity_log']
  const run = d.transaction(() => {
    for (const t of tables) d.prepare(`DELETE FROM ${t}`).run()
    resetSequences(d, tables)
  })
  run()
}
