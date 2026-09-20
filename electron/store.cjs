const { DatabaseSync, backup } = require('node:sqlite')
const fs = require('node:fs')
const path = require('node:path')

function validText(value, label) {
  const text = String(value ?? '').trim()
  if (!text || text.length > 120) throw new Error(`${label} باید بین ۱ تا ۱۲۰ نویسه باشد.`)
  return text
}

function validInt(value, label, minimum = 0) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < minimum) throw new Error(`${label} معتبر نیست.`)
  return number
}

function validSignedInt(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error(`${label} معتبر نیست.`)
  return number
}

function optionalText(value, label, maximum = 120) {
  const text = String(value ?? '').trim()
  if (text.length > maximum) throw new Error(`${label} بیش از حد طولانی است.`)
  return text || null
}

function validEnum(value, list, label) {
  if (!list.includes(value)) throw new Error(`${label} معتبر نیست.`)
  return value
}

function nowISO() { return new Date().toISOString() }

function productInput(input) {
  return {
    name: validText(input.name, 'نام محصول'),
    price: validInt(input.price, 'قیمت فروش', 1),
    category: optionalText(input.category, 'گروه محصول') || 'بدون گروه',
    sku: optionalText(input.sku, 'کد محصول', 60),
    barcode: optionalText(input.barcode, 'بارکد', 60),
    unit: optionalText(input.unit, 'واحد سنجش', 30) || 'عدد',
    purchasePrice: validInt(input.purchasePrice ?? 0, 'قیمت خرید'),
    minStock: validInt(input.minStock ?? 0, 'حداقل موجودی'),
  }
}

const INVOICE_TYPES = ['sale', 'purchase', 'sale_return', 'purchase_return']
const VOUCHER_KINDS = ['input', 'output', 'transfer']
const CASH_KINDS = ['receipt', 'payment']
const CASH_METHODS = ['cash', 'card', 'bank_transfer', 'cheque']
const CHEQUE_KINDS = ['receivable', 'payable']
const CHEQUE_STATUS = ['pending', 'collected', 'bounced', 'spent', 'returned']
const PERSON_TYPES = ['customer', 'supplier', 'both', 'other']

function openDatabase(file) {
  const database = new DatabaseSync(file)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0),
      stock INTEGER NOT NULL CHECK (stock >= 0)
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price > 0),
      total INTEGER NOT NULL CHECK (total > 0),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL
    );
  `)
  let version = database.prepare('PRAGMA user_version').get().user_version
  if (version > 3) throw new Error('نسخهٔ پایگاه داده از این برنامه جدیدتر است.')
  if (version < 2) {
    database.exec(`
      ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'بدون گروه';
      ALTER TABLE products ADD COLUMN sku TEXT;
      ALTER TABLE products ADD COLUMN barcode TEXT;
      ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'عدد';
      ALTER TABLE products ADD COLUMN purchase_price INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        change_amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = 2;
    `)
    version = 2
  }
  if (version < 3) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        phone TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fiscal_years (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL UNIQUE,
        start_date TEXT,
        end_date TEXT,
        is_closed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'customer',
        phone TEXT,
        address TEXT,
        opening_balance INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        person_id INTEGER REFERENCES persons(id),
        branch_id INTEGER REFERENCES branches(id),
        fiscal_year_id INTEGER REFERENCES fiscal_years(id),
        invoice_date TEXT NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        tax INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
        total INTEGER NOT NULL CHECK (total >= 0)
      );
      CREATE TABLE IF NOT EXISTS stock_vouchers (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id),
        reason TEXT NOT NULL,
        voucher_date TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stock_voucher_items (
        id INTEGER PRIMARY KEY,
        voucher_id INTEGER NOT NULL REFERENCES stock_vouchers(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        person_id INTEGER REFERENCES persons(id),
        branch_id INTEGER REFERENCES branches(id),
        method TEXT NOT NULL DEFAULT 'cash',
        amount INTEGER NOT NULL CHECK (amount > 0),
        txn_date TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cheques (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        person_id INTEGER REFERENCES persons(id),
        amount INTEGER NOT NULL CHECK (amount > 0),
        cheque_number TEXT NOT NULL,
        bank TEXT,
        issue_date TEXT,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS journal_vouchers (
        id INTEGER PRIMARY KEY,
        voucher_date TEXT NOT NULL,
        branch_id INTEGER REFERENCES branches(id),
        fiscal_year_id INTEGER REFERENCES fiscal_years(id),
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER PRIMARY KEY,
        voucher_id INTEGER NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
        account_title TEXT NOT NULL,
        debit INTEGER NOT NULL DEFAULT 0,
        credit INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT,
        phone TEXT,
        base_salary INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS payrolls (
        id INTEGER PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        bonus INTEGER NOT NULL DEFAULT 0,
        deduction INTEGER NOT NULL DEFAULT 0,
        net INTEGER NOT NULL DEFAULT 0,
        paid INTEGER NOT NULL DEFAULT 0,
        payroll_date TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_cash_date ON cash_transactions(txn_date);
      CREATE INDEX IF NOT EXISTS idx_cheques_due ON cheques(due_date);
      PRAGMA user_version = 3;
    `)
  }
  return database
}

function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  let database = openDatabase(file)

  function getState() {
    const invoices = database.prepare('SELECT id, type, person_id AS personId, branch_id AS branchId, fiscal_year_id AS fiscalYearId, invoice_date AS invoiceDate, discount, tax, total, description, created_at AS createdAt FROM invoices ORDER BY id DESC').all()
    for (const inv of invoices) {
      const person = inv.personId ? database.prepare('SELECT name FROM persons WHERE id = ?').get(inv.personId) : null
      inv.personName = person ? person.name : '—'
      inv.items = database.prepare('SELECT id, product_id AS productId, product_name AS productName, quantity, unit_price AS unitPrice, total FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(inv.id)
    }
    const stockVouchers = database.prepare('SELECT id, kind, branch_id AS branchId, reason, voucher_date AS voucherDate, description, created_at AS createdAt FROM stock_vouchers ORDER BY id DESC').all()
    for (const v of stockVouchers) v.items = database.prepare('SELECT svi.id, svi.product_id AS productId, p.name AS productName, svi.quantity FROM stock_voucher_items svi LEFT JOIN products p ON p.id = svi.product_id WHERE svi.voucher_id = ? ORDER BY svi.id').all(v.id)
    const journals = database.prepare('SELECT id, voucher_date AS voucherDate, branch_id AS branchId, fiscal_year_id AS fiscalYearId, description, created_at AS createdAt FROM journal_vouchers ORDER BY id DESC').all()
    for (const j of journals) j.lines = database.prepare('SELECT id, account_title AS accountTitle, debit, credit FROM journal_lines WHERE voucher_id = ? ORDER BY id').all(j.id)
    return {
      products: database.prepare('SELECT id, name, price, stock, category, sku, barcode, unit, purchase_price AS purchasePrice, min_stock AS minStock, active FROM products ORDER BY id DESC').all(),
      sales: database.prepare('SELECT id, name, quantity, total, created_at AS createdAt FROM sales ORDER BY id DESC').all(),
      expenses: database.prepare('SELECT id, name, amount, created_at AS createdAt FROM expenses ORDER BY id DESC').all(),
      branches: database.prepare('SELECT id, name, address, phone, active, created_at AS createdAt FROM branches ORDER BY id').all(),
      fiscalYears: database.prepare('SELECT id, title, start_date AS startDate, end_date AS endDate, is_closed AS isClosed, created_at AS createdAt FROM fiscal_years ORDER BY id DESC').all(),
      persons: database.prepare('SELECT id, name, type, phone, address, opening_balance AS openingBalance, active, created_at AS createdAt FROM persons ORDER BY id DESC').all(),
      invoices,
      stockVouchers,
      cashTransactions: database.prepare('SELECT ct.id, ct.kind, ct.person_id AS personId, p.name AS personName, ct.branch_id AS branchId, ct.method, ct.amount, ct.txn_date AS txnDate, ct.description, ct.created_at AS createdAt FROM cash_transactions ct LEFT JOIN persons p ON p.id = ct.person_id ORDER BY ct.id DESC').all(),
      cheques: database.prepare('SELECT c.id, c.kind, c.person_id AS personId, p.name AS personName, c.amount, c.cheque_number AS chequeNumber, c.bank, c.issue_date AS issueDate, c.due_date AS dueDate, c.status, c.description, c.created_at AS createdAt FROM cheques c LEFT JOIN persons p ON p.id = c.person_id ORDER BY c.due_date, c.id DESC').all(),
      journalVouchers: journals,
      employees: database.prepare('SELECT id, name, role, phone, base_salary AS baseSalary, active, created_at AS createdAt FROM employees ORDER BY id DESC').all(),
      payrolls: database.prepare('SELECT pl.id, pl.employee_id AS employeeId, e.name AS employeeName, pl.month, pl.amount, pl.bonus, pl.deduction, pl.net, pl.paid, pl.payroll_date AS payrollDate, pl.description, pl.created_at AS createdAt FROM payrolls pl JOIN employees e ON e.id = pl.employee_id ORDER BY pl.id DESC').all(),
      stockMovements: database.prepare('SELECT sm.id, sm.product_id AS productId, p.name AS productName, sm.change_amount AS changeAmount, sm.reason, sm.created_at AS createdAt FROM stock_movements sm LEFT JOIN products p ON p.id = sm.product_id ORDER BY sm.id DESC LIMIT 300').all(),
    }
  }

  // ---------- products / sales / expenses (existing + delete) ----------
  function addProduct(input) {
    const item = productInput(input)
    const stock = validInt(input.stock, 'موجودی')
    database.exec('BEGIN IMMEDIATE')
    try {
      const result = database.prepare('INSERT INTO products (name, price, stock, category, sku, barcode, unit, purchase_price, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(item.name, item.price, stock, item.category, item.sku, item.barcode, item.unit, item.purchasePrice, item.minStock)
      if (stock > 0) database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(result.lastInsertRowid, stock, 'موجودی اولیه', nowISO())
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function updateProduct(input) {
    const id = validInt(input.id, 'محصول', 1)
    const item = productInput(input)
    const active = input.active ? 1 : 0
    const result = database.prepare('UPDATE products SET name = ?, price = ?, category = ?, sku = ?, barcode = ?, unit = ?, purchase_price = ?, min_stock = ?, active = ? WHERE id = ?').run(item.name, item.price, item.category, item.sku, item.barcode, item.unit, item.purchasePrice, item.minStock, active, id)
    if (!result.changes) throw new Error('محصول پیدا نشد.')
    return getState()
  }

  function deleteProduct(input) {
    const id = validInt(input.id, 'محصول', 1)
    const used = database.prepare('SELECT COUNT(*) AS c FROM sales WHERE product_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM invoice_items WHERE product_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM stock_voucher_items WHERE product_id = ?').get(id).c
    if (used > 0) {
      database.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id)
    } else {
      database.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id)
      const r = database.prepare('DELETE FROM products WHERE id = ?').run(id)
      if (!r.changes) throw new Error('محصول پیدا نشد.')
    }
    return getState()
  }

  function adjustStock(input) {
    const id = validInt(input.productId, 'محصول', 1)
    const change = Number(input.change)
    if (!Number.isSafeInteger(change) || change === 0) throw new Error('تغییر موجودی باید عدد صحیح غیر صفر باشد.')
    const reason = validText(input.reason, 'دلیل اصلاح موجودی')
    database.exec('BEGIN IMMEDIATE')
    try {
      const result = database.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0').run(change, id, change)
      if (!result.changes) throw new Error('محصول پیدا نشد یا موجودی کافی نیست.')
      database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(id, change, reason, nowISO())
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function addSale(input) {
    const id = validInt(input.productId, 'محصول', 1)
    const quantity = validInt(input.quantity, 'تعداد', 1)
    database.exec('BEGIN IMMEDIATE')
    try {
      const product = database.prepare('SELECT id, name, price, stock, active FROM products WHERE id = ?').get(id)
      if (!product) throw new Error('محصول پیدا نشد.')
      if (!product.active) throw new Error('فروش این محصول غیرفعال است.')
      if (product.stock < quantity) throw new Error('موجودی محصول کافی نیست.')
      const total = product.price * quantity
      if (!Number.isSafeInteger(total)) throw new Error('مبلغ فروش بیش از حد مجاز است.')
      database.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, id)
      database.prepare('INSERT INTO sales (product_id, name, quantity, unit_price, total, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, product.name, quantity, product.price, total, nowISO())
      database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(id, -quantity, 'فروش', nowISO())
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return getState()
  }

  function deleteSale(input) {
    const id = validInt(input.id, 'فروش', 1)
    database.exec('BEGIN IMMEDIATE')
    try {
      const sale = database.prepare('SELECT id, product_id AS productId, quantity FROM sales WHERE id = ?').get(id)
      if (!sale) throw new Error('فروش پیدا نشد.')
      database.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(sale.quantity, sale.productId)
      database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(sale.productId, sale.quantity, 'حذف فروش', nowISO())
      database.prepare('DELETE FROM sales WHERE id = ?').run(id)
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function addExpense(input) {
    const name = validText(input.name, 'عنوان هزینه')
    const amount = validInt(input.amount, 'مبلغ', 1)
    database.prepare('INSERT INTO expenses (name, amount, created_at) VALUES (?, ?, ?)').run(name, amount, nowISO())
    return getState()
  }

  function updateExpense(input) {
    const id = validInt(input.id, 'هزینه', 1)
    const name = validText(input.name, 'عنوان هزینه')
    const amount = validInt(input.amount, 'مبلغ', 1)
    const r = database.prepare('UPDATE expenses SET name = ?, amount = ? WHERE id = ?').run(name, amount, id)
    if (!r.changes) throw new Error('هزینه پیدا نشد.')
    return getState()
  }

  function deleteExpense(input) {
    const id = validInt(input.id, 'هزینه', 1)
    const r = database.prepare('DELETE FROM expenses WHERE id = ?').run(id)
    if (!r.changes) throw new Error('هزینه پیدا نشد.')
    return getState()
  }

  // ---------- branches ----------
  function addBranch(input) {
    const name = validText(input.name, 'نام شعبه')
    const address = optionalText(input.address, 'نشانی', 300)
    const phone = optionalText(input.phone, 'تلفن', 30)
    database.prepare('INSERT INTO branches (name, address, phone, active, created_at) VALUES (?, ?, ?, 1, ?)').run(name, address, phone, nowISO())
    return getState()
  }
  function updateBranch(input) {
    const id = validInt(input.id, 'شعبه', 1)
    const name = validText(input.name, 'نام شعبه')
    const address = optionalText(input.address, 'نشانی', 300)
    const phone = optionalText(input.phone, 'تلفن', 30)
    const active = input.active ? 1 : 0
    const r = database.prepare('UPDATE branches SET name = ?, address = ?, phone = ?, active = ? WHERE id = ?').run(name, address, phone, active, id)
    if (!r.changes) throw new Error('شعبه پیدا نشد.')
    return getState()
  }
  function deleteBranch(input) {
    const id = validInt(input.id, 'شعبه', 1)
    const used = database.prepare('SELECT COUNT(*) AS c FROM invoices WHERE branch_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM cash_transactions WHERE branch_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM stock_vouchers WHERE branch_id = ?').get(id).c
    if (used > 0) throw new Error('این شعبه در اسناد استفاده شده؛ به‌جای حذف، آن را غیرفعال کنید.')
    const r = database.prepare('DELETE FROM branches WHERE id = ?').run(id)
    if (!r.changes) throw new Error('شعبه پیدا نشد.')
    return getState()
  }

  // ---------- fiscal years ----------
  function addFiscalYear(input) {
    const title = validText(input.title, 'عنوان سال مالی')
    const startDate = optionalText(input.startDate, 'تاریخ شروع', 30)
    const endDate = optionalText(input.endDate, 'تاریخ پایان', 30)
    database.prepare('INSERT INTO fiscal_years (title, start_date, end_date, is_closed, created_at) VALUES (?, ?, ?, 0, ?)').run(title, startDate, endDate, nowISO())
    return getState()
  }
  function updateFiscalYear(input) {
    const id = validInt(input.id, 'سال مالی', 1)
    const title = validText(input.title, 'عنوان سال مالی')
    const startDate = optionalText(input.startDate, 'تاریخ شروع', 30)
    const endDate = optionalText(input.endDate, 'تاریخ پایان', 30)
    const r = database.prepare('UPDATE fiscal_years SET title = ?, start_date = ?, end_date = ? WHERE id = ?').run(title, startDate, endDate, id)
    if (!r.changes) throw new Error('سال مالی پیدا نشد.')
    return getState()
  }
  function setFiscalYearClosed(input) {
    const id = validInt(input.id, 'سال مالی', 1)
    const closed = input.closed ? 1 : 0
    const r = database.prepare('UPDATE fiscal_years SET is_closed = ? WHERE id = ?').run(closed, id)
    if (!r.changes) throw new Error('سال مالی پیدا نشد.')
    return getState()
  }
  function deleteFiscalYear(input) {
    const id = validInt(input.id, 'سال مالی', 1)
    const used = database.prepare('SELECT COUNT(*) AS c FROM invoices WHERE fiscal_year_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM journal_vouchers WHERE fiscal_year_id = ?').get(id).c
    if (used > 0) throw new Error('این سال مالی در اسناد استفاده شده و قابل حذف نیست؛ آن را ببندید.')
    const r = database.prepare('DELETE FROM fiscal_years WHERE id = ?').run(id)
    if (!r.changes) throw new Error('سال مالی پیدا نشد.')
    return getState()
  }
  function assertYearOpen(fiscalYearId) {
    if (!fiscalYearId) return
    const y = database.prepare('SELECT is_closed AS isClosed FROM fiscal_years WHERE id = ?').get(fiscalYearId)
    if (y && y.isClosed) throw new Error('سال مالی بسته شده و ثبت سند جدید در آن مجاز نیست.')
  }

  // ---------- persons ----------
  function addPerson(input) {
    const name = validText(input.name, 'نام شخص')
    const type = PERSON_TYPES.includes(input.type) ? input.type : 'customer'
    const phone = optionalText(input.phone, 'تلفن', 30)
    const address = optionalText(input.address, 'نشانی', 300)
    const openingBalance = validSignedInt(input.openingBalance ?? 0, 'ماندهٔ اول دوره')
    database.prepare('INSERT INTO persons (name, type, phone, address, opening_balance, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(name, type, phone, address, openingBalance, nowISO())
    return getState()
  }
  function updatePerson(input) {
    const id = validInt(input.id, 'شخص', 1)
    const name = validText(input.name, 'نام شخص')
    const type = validEnum(input.type, PERSON_TYPES, 'نوع طرف‌حساب')
    const phone = optionalText(input.phone, 'تلفن', 30)
    const address = optionalText(input.address, 'نشانی', 300)
    const openingBalance = validSignedInt(input.openingBalance ?? 0, 'ماندهٔ اول دوره')
    const active = input.active ? 1 : 0
    const r = database.prepare('UPDATE persons SET name = ?, type = ?, phone = ?, address = ?, opening_balance = ?, active = ? WHERE id = ?').run(name, type, phone, address, openingBalance, active, id)
    if (!r.changes) throw new Error('شخص پیدا نشد.')
    return getState()
  }
  function deletePerson(input) {
    const id = validInt(input.id, 'شخص', 1)
    const used = database.prepare('SELECT COUNT(*) AS c FROM invoices WHERE person_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM cash_transactions WHERE person_id = ?').get(id).c
      + database.prepare('SELECT COUNT(*) AS c FROM cheques WHERE person_id = ?').get(id).c
    if (used > 0) throw new Error('این شخص در اسناد استفاده شده؛ به‌جای حذف، آن را غیرفعال کنید.')
    const r = database.prepare('DELETE FROM persons WHERE id = ?').run(id)
    if (!r.changes) throw new Error('شخص پیدا نشد.')
    return getState()
  }

  // ---------- invoices (multi-line) ----------
  function normalizeInvoiceItems(items) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('فاکتور باید دست‌کم یک قلم داشته باشد.')
    if (items.length > 100) throw new Error('تعداد اقلام فاکتور بیش از حد مجاز است.')
    return items.map((it) => ({
      productId: validInt(it.productId, 'کالا', 1),
      quantity: validInt(it.quantity, 'تعداد', 1),
      unitPrice: it.unitPrice === undefined || it.unitPrice === null || it.unitPrice === '' ? null : validInt(it.unitPrice, 'قیمت واحد'),
    }))
  }

  function invoiceStockSign(type) {
    if (type === 'sale') return -1
    if (type === 'sale_return') return 1
    if (type === 'purchase') return 1
    if (type === 'purchase_return') return -1
    throw new Error('نوع فاکتور معتبر نیست.')
  }

  function createInvoice(input) {
    const type = validEnum(input.type, INVOICE_TYPES, 'نوع فاکتور')
    const items = normalizeInvoiceItems(input.items)
    const discount = validInt(input.discount ?? 0, 'تخفیف')
    const tax = validInt(input.tax ?? 0, 'مالیات')
    const personId = input.personId ? validInt(input.personId, 'طرف‌حساب', 1) : null
    const branchId = input.branchId ? validInt(input.branchId, 'شعبه', 1) : null
    const fiscalYearId = input.fiscalYearId ? validInt(input.fiscalYearId, 'سال مالی', 1) : null
    const description = optionalText(input.description, 'شرح', 500)
    const invoiceDate = String(input.invoiceDate || nowISO()).slice(0, 30)
    assertYearOpen(fiscalYearId)
    const sign = invoiceStockSign(type)
    database.exec('BEGIN IMMEDIATE')
    try {
      let sum = 0
      const resolved = []
      for (const it of items) {
        const product = database.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(it.productId)
        if (!product) throw new Error('یکی از کالاها پیدا نشد.')
        const unitPrice = it.unitPrice ?? product.price
        const total = unitPrice * it.quantity
        if (!Number.isSafeInteger(total)) throw new Error('مبلغ قلم بیش از حد مجاز است.')
        sum += total
        resolved.push({ product, quantity: it.quantity, unitPrice, total })
      }
      const total = sum - discount + tax
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('جمع فاکتور معتبر نیست (تخفیف بیشتر از جمع اقلام است).')
      if (sign < 0) {
        for (const r of resolved) {
          if (r.product.stock < r.quantity) throw new Error(`موجودی «${r.product.name}» کافی نیست.`)
        }
      }
      const head = database.prepare('INSERT INTO invoices (type, person_id, branch_id, fiscal_year_id, invoice_date, discount, tax, total, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(type, personId, branchId, fiscalYearId, invoiceDate, discount, tax, total, description, nowISO())
      const invoiceId = head.lastInsertRowid
      for (const r of resolved) {
        database.prepare('INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)').run(invoiceId, r.product.id, r.product.name, r.quantity, r.unitPrice, r.total)
        database.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(sign * r.quantity, r.product.id)
        database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(r.product.id, sign * r.quantity, `فاکتور #${invoiceId}`, nowISO())
      }
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function deleteInvoice(input) {
    const id = validInt(input.id, 'فاکتور', 1)
    database.exec('BEGIN IMMEDIATE')
    try {
      const head = database.prepare('SELECT id, type FROM invoices WHERE id = ?').get(id)
      if (!head) throw new Error('فاکتور پیدا نشد.')
      const sign = invoiceStockSign(head.type)
      const items = database.prepare('SELECT product_id AS productId, quantity FROM invoice_items WHERE invoice_id = ?').all(id)
      if (sign > 0) {
        for (const it of items) {
          const p = database.prepare('SELECT stock FROM products WHERE id = ?').get(it.productId)
          if (p && p.stock < it.quantity) throw new Error('موجودی برای برگشت فاکتور کافی نیست.')
        }
      }
      for (const it of items) {
        database.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(sign * it.quantity, it.productId)
        database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(it.productId, -sign * it.quantity, `حذف فاکتور #${id}`, nowISO())
      }
      database.prepare('DELETE FROM invoices WHERE id = ?').run(id)
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  // ---------- stock vouchers ----------
  function createStockVoucher(input) {
    const kind = validEnum(input.kind, VOUCHER_KINDS, 'نوع حواله')
    const reason = validText(input.reason, 'دلیل حواله')
    const branchId = input.branchId ? validInt(input.branchId, 'شعبه', 1) : null
    const description = optionalText(input.description, 'شرح', 500)
    const voucherDate = String(input.voucherDate || nowISO()).slice(0, 30)
    const items = normalizeInvoiceItems((input.items || []).map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: 0 })))
    database.exec('BEGIN IMMEDIATE')
    try {
      const head = database.prepare('INSERT INTO stock_vouchers (kind, branch_id, reason, voucher_date, description, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(kind, branchId, reason, voucherDate, description, nowISO())
      const voucherId = head.lastInsertRowid
      for (const it of items) {
        const product = database.prepare('SELECT id, stock FROM products WHERE id = ?').get(it.productId)
        if (!product) throw new Error('یکی از کالاها پیدا نشد.')
        const delta = kind === 'input' ? it.quantity : kind === 'output' ? -it.quantity : 0
        if (delta < 0 && product.stock < it.quantity) throw new Error('موجودی یکی از کالاها کافی نیست.')
        database.prepare('INSERT INTO stock_voucher_items (voucher_id, product_id, quantity) VALUES (?, ?, ?)').run(voucherId, it.productId, it.quantity)
        if (delta !== 0) {
          database.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, it.productId)
          database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(it.productId, delta, `حواله #${voucherId}`, nowISO())
        }
      }
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function deleteStockVoucher(input) {
    const id = validInt(input.id, 'حواله', 1)
    database.exec('BEGIN IMMEDIATE')
    try {
      const head = database.prepare('SELECT id, kind FROM stock_vouchers WHERE id = ?').get(id)
      if (!head) throw new Error('حواله پیدا نشد.')
      const items = database.prepare('SELECT product_id AS productId, quantity FROM stock_voucher_items WHERE voucher_id = ?').all(id)
      const reverse = head.kind === 'input' ? -1 : head.kind === 'output' ? 1 : 0
      if (reverse !== 0) {
        for (const it of items) {
          const p = database.prepare('SELECT stock FROM products WHERE id = ?').get(it.productId)
          if (reverse < 0 && p && p.stock < it.quantity) throw new Error('موجودی برای حذف حواله کافی نیست.')
        }
        for (const it of items) {
          database.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(reverse * it.quantity, it.productId)
          database.prepare('INSERT INTO stock_movements (product_id, change_amount, reason, created_at) VALUES (?, ?, ?, ?)').run(it.productId, reverse * it.quantity, `حذف حواله #${id}`, nowISO())
        }
      }
      database.prepare('DELETE FROM stock_vouchers WHERE id = ?').run(id)
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  // ---------- cash ----------
  function addCash(input) {
    const kind = validEnum(input.kind, CASH_KINDS, 'نوع عملیات')
    const method = CASH_METHODS.includes(input.method) ? input.method : 'cash'
    const amount = validInt(input.amount, 'مبلغ', 1)
    const personId = input.personId ? validInt(input.personId, 'طرف‌حساب', 1) : null
    const branchId = input.branchId ? validInt(input.branchId, 'شعبه', 1) : null
    const description = optionalText(input.description, 'شرح', 500)
    const txnDate = String(input.txnDate || nowISO()).slice(0, 30)
    database.prepare('INSERT INTO cash_transactions (kind, person_id, branch_id, method, amount, txn_date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(kind, personId, branchId, method, amount, txnDate, description, nowISO())
    return getState()
  }
  function updateCash(input) {
    const id = validInt(input.id, 'عملیات', 1)
    const kind = validEnum(input.kind, CASH_KINDS, 'نوع عملیات')
    const method = validEnum(input.method, CASH_METHODS, 'روش پرداخت')
    const amount = validInt(input.amount, 'مبلغ', 1)
    const personId = input.personId ? validInt(input.personId, 'طرف‌حساب', 1) : null
    const branchId = input.branchId ? validInt(input.branchId, 'شعبه', 1) : null
    const description = optionalText(input.description, 'شرح', 500)
    const txnDate = String(input.txnDate || nowISO()).slice(0, 30)
    const r = database.prepare('UPDATE cash_transactions SET kind = ?, person_id = ?, branch_id = ?, method = ?, amount = ?, txn_date = ?, description = ? WHERE id = ?').run(kind, personId, branchId, method, amount, txnDate, description, id)
    if (!r.changes) throw new Error('عملیات پیدا نشد.')
    return getState()
  }
  function deleteCash(input) {
    const id = validInt(input.id, 'عملیات', 1)
    const r = database.prepare('DELETE FROM cash_transactions WHERE id = ?').run(id)
    if (!r.changes) throw new Error('عملیات پیدا نشد.')
    return getState()
  }

  // ---------- cheques ----------
  function addCheque(input) {
    const kind = validEnum(input.kind, CHEQUE_KINDS, 'نوع چک')
    const amount = validInt(input.amount, 'مبلغ', 1)
    const chequeNumber = validText(input.chequeNumber, 'شماره چک')
    const bank = optionalText(input.bank, 'بانک', 120)
    const personId = input.personId ? validInt(input.personId, 'طرف‌حساب', 1) : null
    const issueDate = optionalText(input.issueDate, 'تاریخ صدور', 30)
    const dueDate = validText(input.dueDate, 'تاریخ سررسید')
    const description = optionalText(input.description, 'شرح', 500)
    database.prepare('INSERT INTO cheques (kind, person_id, amount, cheque_number, bank, issue_date, due_date, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(kind, personId, amount, chequeNumber, bank, issueDate, dueDate, 'pending', description, nowISO())
    return getState()
  }
  function updateCheque(input) {
    const id = validInt(input.id, 'چک', 1)
    const kind = validEnum(input.kind, CHEQUE_KINDS, 'نوع چک')
    const amount = validInt(input.amount, 'مبلغ', 1)
    const chequeNumber = validText(input.chequeNumber, 'شماره چک')
    const bank = optionalText(input.bank, 'بانک', 120)
    const personId = input.personId ? validInt(input.personId, 'طرف‌حساب', 1) : null
    const issueDate = optionalText(input.issueDate, 'تاریخ صدور', 30)
    const dueDate = validText(input.dueDate, 'تاریخ سررسید')
    const status = validEnum(input.status, CHEQUE_STATUS, 'وضعیت چک')
    const description = optionalText(input.description, 'شرح', 500)
    const r = database.prepare('UPDATE cheques SET kind = ?, person_id = ?, amount = ?, cheque_number = ?, bank = ?, issue_date = ?, due_date = ?, status = ?, description = ? WHERE id = ?').run(kind, personId, amount, chequeNumber, bank, issueDate, dueDate, status, description, id)
    if (!r.changes) throw new Error('چک پیدا نشد.')
    return getState()
  }
  function deleteCheque(input) {
    const id = validInt(input.id, 'چک', 1)
    const r = database.prepare('DELETE FROM cheques WHERE id = ?').run(id)
    if (!r.changes) throw new Error('چک پیدا نشد.')
    return getState()
  }

  // ---------- journal ----------
  function validateJournalLines(lines) {
    if (!Array.isArray(lines) || lines.length < 2) throw new Error('سند باید دست‌کم دو آرتیکل داشته باشد.')
    if (lines.length > 50) throw new Error('تعداد آرتیکل‌های سند بیش از حد مجاز است.')
    let debit = 0
    let credit = 0
    const clean = lines.map((ln) => {
      const accountTitle = validText(ln.accountTitle, 'عنوان حساب')
      const d = validInt(ln.debit ?? 0, 'بدهکار')
      const c = validInt(ln.credit ?? 0, 'بستانکار')
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) throw new Error('هر آرتیکل باید فقط بدهکار یا فقط بستانکار باشد.')
      debit += d
      credit += c
      return { accountTitle, debit: d, credit: c }
    })
    if (debit <= 0 || debit !== credit) throw new Error('جمع بدهکار و بستانکار سند باید برابر و بزرگ‌تر از صفر باشد (سند دوبل).')
    return clean
  }

  function createJournal(input) {
    const description = validText(input.description, 'شرح سند')
    const voucherDate = String(input.voucherDate || nowISO()).slice(0, 30)
    const branchId = input.branchId ? validInt(input.branchId, 'شعبه', 1) : null
    const fiscalYearId = input.fiscalYearId ? validInt(input.fiscalYearId, 'سال مالی', 1) : null
    assertYearOpen(fiscalYearId)
    const lines = validateJournalLines(input.lines)
    database.exec('BEGIN IMMEDIATE')
    try {
      const head = database.prepare('INSERT INTO journal_vouchers (voucher_date, branch_id, fiscal_year_id, description, created_at) VALUES (?, ?, ?, ?, ?)').run(voucherDate, branchId, fiscalYearId, description, nowISO())
      const vid = head.lastInsertRowid
      for (const ln of lines) database.prepare('INSERT INTO journal_lines (voucher_id, account_title, debit, credit) VALUES (?, ?, ?, ?)').run(vid, ln.accountTitle, ln.debit, ln.credit)
      database.exec('COMMIT')
    } catch (error) { database.exec('ROLLBACK'); throw error }
    return getState()
  }

  function deleteJournal(input) {
    const id = validInt(input.id, 'سند', 1)
    const r = database.prepare('DELETE FROM journal_vouchers WHERE id = ?').run(id)
    if (!r.changes) throw new Error('سند پیدا نشد.')
    return getState()
  }

  // ---------- employees / payroll ----------
  function addEmployee(input) {
    const name = validText(input.name, 'نام کارمند')
    const role = optionalText(input.role, 'سمت', 120)
    const phone = optionalText(input.phone, 'تلفن', 30)
    const baseSalary = validInt(input.baseSalary ?? 0, 'حقوق پایه')
    database.prepare('INSERT INTO employees (name, role, phone, base_salary, active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(name, role, phone, baseSalary, nowISO())
    return getState()
  }
  function updateEmployee(input) {
    const id = validInt(input.id, 'کارمند', 1)
    const name = validText(input.name, 'نام کارمند')
    const role = optionalText(input.role, 'سمت', 120)
    const phone = optionalText(input.phone, 'تلفن', 30)
    const baseSalary = validInt(input.baseSalary ?? 0, 'حقوق پایه')
    const active = input.active ? 1 : 0
    const r = database.prepare('UPDATE employees SET name = ?, role = ?, phone = ?, base_salary = ?, active = ? WHERE id = ?').run(name, role, phone, baseSalary, active, id)
    if (!r.changes) throw new Error('کارمند پیدا نشد.')
    return getState()
  }
  function deleteEmployee(input) {
    const id = validInt(input.id, 'کارمند', 1)
    const used = database.prepare('SELECT COUNT(*) AS c FROM payrolls WHERE employee_id = ?').get(id).c
    if (used > 0) throw new Error('این کارمند حقوق ثبت‌شده دارد؛ به‌جای حذف، آن را غیرفعال کنید.')
    const r = database.prepare('DELETE FROM employees WHERE id = ?').run(id)
    if (!r.changes) throw new Error('کارمند پیدا نشد.')
    return getState()
  }
  function addPayroll(input) {
    const employeeId = validInt(input.employeeId, 'کارمند', 1)
    const month = validText(input.month, 'ماه')
    const amount = validInt(input.amount ?? 0, 'مبلغ حقوق')
    const bonus = validInt(input.bonus ?? 0, 'مزایا')
    const deduction = validInt(input.deduction ?? 0, 'کسورات')
    const net = amount + bonus - deduction
    if (!Number.isSafeInteger(net) || net < 0) throw new Error('خالص پرداختی معتبر نیست.')
    const payrollDate = String(input.payrollDate || nowISO()).slice(0, 30)
    const description = optionalText(input.description, 'شرح', 500)
    const paid = input.paid ? 1 : 0
    const emp = database.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId)
    if (!emp) throw new Error('کارمند پیدا نشد.')
    database.prepare('INSERT INTO payrolls (employee_id, month, amount, bonus, deduction, net, paid, payroll_date, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(employeeId, month, amount, bonus, deduction, net, paid, payrollDate, description, nowISO())
    return getState()
  }
  function updatePayroll(input) {
    const id = validInt(input.id, 'حقوق', 1)
    const month = validText(input.month, 'ماه')
    const amount = validInt(input.amount ?? 0, 'مبلغ حقوق')
    const bonus = validInt(input.bonus ?? 0, 'مزایا')
    const deduction = validInt(input.deduction ?? 0, 'کسورات')
    const net = amount + bonus - deduction
    if (!Number.isSafeInteger(net) || net < 0) throw new Error('خالص پرداختی معتبر نیست.')
    const payrollDate = String(input.payrollDate || nowISO()).slice(0, 30)
    const description = optionalText(input.description, 'شرح', 500)
    const paid = input.paid ? 1 : 0
    const r = database.prepare('UPDATE payrolls SET month = ?, amount = ?, bonus = ?, deduction = ?, net = ?, paid = ?, payroll_date = ?, description = ? WHERE id = ?').run(month, amount, bonus, deduction, net, paid, payrollDate, description, id)
    if (!r.changes) throw new Error('رکورد حقوق پیدا نشد.')
    return getState()
  }
  function deletePayroll(input) {
    const id = validInt(input.id, 'حقوق', 1)
    const r = database.prepare('DELETE FROM payrolls WHERE id = ?').run(id)
    if (!r.changes) throw new Error('رکورد حقوق پیدا نشد.')
    return getState()
  }

  async function backupTo(destination) {
    if (path.resolve(destination) === path.resolve(file)) throw new Error('مسیر پشتیبان باید جدا از پایگاه داده باشد.')
    await backup(database, destination)
    return destination
  }

  async function restoreFrom(source) {
    if (path.resolve(source) === path.resolve(file)) throw new Error('فایل فعلی را نمی‌توان به عنوان پشتیبان بازگرداند.')
    const candidate = new DatabaseSync(source, { readOnly: true })
    try {
      const integrity = candidate.prepare('PRAGMA integrity_check').get()
      const version = candidate.prepare('PRAGMA user_version').get().user_version
      const tables = candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('products', 'sales', 'expenses')").all()
      if (integrity.integrity_check !== 'ok' || ![1, 2, 3].includes(version) || tables.length !== 3) throw new Error('فایل پشتیبان معتبر آوای گندم نیست.')
    } finally {
      candidate.close()
    }
    const safety = path.join(path.dirname(file), `before-restore-${Date.now()}.sqlite`)
    await backupTo(safety)
    database.close()
    try {
      fs.copyFileSync(source, file)
      database = openDatabase(file)
      return getState()
    } catch (error) {
      fs.copyFileSync(safety, file)
      database = openDatabase(file)
      throw error
    }
  }

  return {
    getState,
    addProduct, updateProduct, deleteProduct, adjustStock, addSale, deleteSale,
    addExpense, updateExpense, deleteExpense,
    addBranch, updateBranch, deleteBranch,
    addFiscalYear, updateFiscalYear, setFiscalYearClosed, deleteFiscalYear,
    addPerson, updatePerson, deletePerson,
    createInvoice, deleteInvoice,
    createStockVoucher, deleteStockVoucher,
    addCash, updateCash, deleteCash,
    addCheque, updateCheque, deleteCheque,
    createJournal, deleteJournal,
    addEmployee, updateEmployee, deleteEmployee,
    addPayroll, updatePayroll, deletePayroll,
    backupTo, restoreFrom, close: () => database.close(),
  }
}

module.exports = { createStore }
