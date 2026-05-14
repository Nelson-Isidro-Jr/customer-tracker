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
  `)
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
  return getCustomerById(result.lastInsertRowid)
}

export function updateCustomer(id, data) {
  getDB().prepare(`
    UPDATE customers SET full_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?
  `).run(data.full_name, data.email || null, data.phone || null, data.notes || null, id)
  return getCustomerById(id)
}

export function deleteCustomer(id) {
  getDB().prepare('DELETE FROM customers WHERE id = ?').run(id)
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
  return { id: result.lastInsertRowid, ...data }
}

export function deleteTransaction(id) {
  getDB().prepare('DELETE FROM transactions WHERE id = ?').run(id)
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
    try {
      d.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='customers'").run()
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
    try {
      d.prepare("DELETE FROM sqlite_sequence WHERE name='transactions'").run()
      d.prepare("DELETE FROM sqlite_sequence WHERE name='customers'").run()
    } catch (_) {}
  })
  run()
}
