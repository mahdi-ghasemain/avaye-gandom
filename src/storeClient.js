// لایهٔ ارتباطی یکسان برای حالت دسکتاپ (SQLite) و حالت نمایشی مرورگر.
// در مرورگر، همهٔ عملیات حسابداری به‌صورت محلی با همان منطق انبار و جمع‌ها شبیه‌سازی می‌شود.
const KEY = 'avaye-demo-v3'
let seq = Date.now()

function nid() { return (seq += 1) }
function iso() { return new Date().toISOString() }

function emptyState() {
  return {
    products: [], sales: [], expenses: [], branches: [], fiscalYears: [],
    persons: [], invoices: [], stockVouchers: [], cashTransactions: [],
    cheques: [], journalVouchers: [], employees: [], payrolls: [], stockMovements: [],
  }
}

export function loadDemoState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return { ...emptyState(), ...parsed }
  } catch { return emptyState() }
}

function saveDemo(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function findProduct(state, id) {
  const p = state.products.find((x) => x.id === Number(id))
  if (!p) throw new Error('کالا پیدا نشد.')
  return p
}

function invoiceSign(type) {
  if (type === 'sale') return -1
  if (type === 'sale_return') return 1
  if (type === 'purchase') return 1
  if (type === 'purchase_return') return -1
  throw new Error('نوع فاکتور معتبر نیست.')
}

// اجرای عملیات در حالت دمو؛ خروجی state جدید است
export function applyDemo(state, method, input = {}) {
  const s = structuredClone(state)
  const touch = () => saveDemo(s)
  switch (method) {
    case 'addProduct': {
      if (!String(input.name || '').trim()) throw new Error('نام محصول لازم است.')
      const stock = Number(input.stock || 0)
      s.products.unshift({ id: nid(), name: String(input.name).trim(), price: Number(input.price), stock, category: input.category || 'بدون گروه', sku: input.sku || '', barcode: input.barcode || '', unit: input.unit || 'عدد', purchasePrice: Number(input.purchasePrice || 0), minStock: Number(input.minStock || 0), active: 1, createdAt: iso() })
      break
    }
    case 'updateProduct': {
      const p = s.products.find((x) => x.id === Number(input.id))
      if (!p) throw new Error('محصول پیدا نشد.')
      Object.assign(p, { name: String(input.name).trim(), price: Number(input.price), category: input.category || 'بدون گروه', sku: input.sku || '', barcode: input.barcode || '', unit: input.unit || 'عدد', purchasePrice: Number(input.purchasePrice || 0), minStock: Number(input.minStock || 0), active: input.active ? 1 : 0 })
      break
    }
    case 'adjustStock': {
      const p = s.products.find((x) => x.id === Number(input.productId))
      if (!p) throw new Error('محصول پیدا نشد.')
      const d = Number(input.change)
      if (p.stock + d < 0) throw new Error('موجودی کافی نیست.')
      p.stock += d
      s.stockMovements.unshift({ id: nid(), productId: p.id, productName: p.name, changeAmount: d, reason: String(input.reason), createdAt: iso() })
      break
    }
    case 'addSale': {
      const p = s.products.find((x) => x.id === Number(input.productId))
      if (!p) throw new Error('محصول پیدا نشد.')
      const q = Number(input.quantity)
      if (p.stock < q) throw new Error('موجودی محصول کافی نیست.')
      p.stock -= q
      s.sales.unshift({ id: nid(), name: p.name, quantity: q, total: p.price * q, createdAt: iso() })
      break
    }
    case 'addExpense': {
      s.expenses.unshift({ id: nid(), name: String(input.name).trim(), amount: Number(input.amount), createdAt: iso() })
      break
    }
    case 'deleteSale': {
      const i = s.sales.findIndex((x) => x.id === Number(input.id))
      if (i < 0) throw new Error('فروش پیدا نشد.')
      const sale = s.sales[i]
      const p = s.products.find((x) => x.name === sale.name) || s.products[0]
      if (p) p.stock += sale.quantity
      s.sales.splice(i, 1)
      break
    }
    case 'updateExpense': {
      const e = s.expenses.find((x) => x.id === Number(input.id))
      if (!e) throw new Error('هزینه پیدا نشد.')
      e.name = String(input.name).trim(); e.amount = Number(input.amount)
      break
    }
    case 'deleteExpense': {
      const i = s.expenses.findIndex((x) => x.id === Number(input.id))
      if (i < 0) throw new Error('هزینه پیدا نشد.')
      s.expenses.splice(i, 1)
      break
    }
    case 'deleteProduct': {
      const i = s.products.findIndex((x) => x.id === Number(input.id))
      if (i < 0) throw new Error('محصول پیدا نشد.')
      const used = s.invoices.some((inv) => inv.items.some((it) => it.productId === Number(input.id)))
      if (used) s.products[i].active = 0
      else s.products.splice(i, 1)
      break
    }
    case 'addBranch': {
      if (!String(input.name || '').trim()) throw new Error('نام شعبه لازم است.')
      s.branches.push({ id: nid(), name: String(input.name).trim(), address: input.address || '', phone: input.phone || '', active: 1, createdAt: iso() })
      break
    }
    case 'updateBranch': {
      const b = s.branches.find((x) => x.id === Number(input.id))
      if (!b) throw new Error('شعبه پیدا نشد.')
      Object.assign(b, { name: String(input.name).trim(), address: input.address || '', phone: input.phone || '', active: input.active ? 1 : 0 })
      break
    }
    case 'deleteBranch': {
      const used = s.invoices.some((x) => x.branchId === Number(input.id)) || s.cashTransactions.some((x) => x.branchId === Number(input.id))
      if (used) throw new Error('این شعبه در اسناد استفاده شده؛ آن را غیرفعال کنید.')
      s.branches = s.branches.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'addFiscalYear': {
      if (!String(input.title || '').trim()) throw new Error('عنوان سال مالی لازم است.')
      s.fiscalYears.push({ id: nid(), title: String(input.title).trim(), startDate: input.startDate || '', endDate: input.endDate || '', isClosed: 0, createdAt: iso() })
      break
    }
    case 'updateFiscalYear': {
      const y = s.fiscalYears.find((x) => x.id === Number(input.id))
      if (!y) throw new Error('سال مالی پیدا نشد.')
      Object.assign(y, { title: String(input.title).trim(), startDate: input.startDate || '', endDate: input.endDate || '' })
      break
    }
    case 'setFiscalYearClosed': {
      const y = s.fiscalYears.find((x) => x.id === Number(input.id))
      if (!y) throw new Error('سال مالی پیدا نشد.')
      y.isClosed = input.closed ? 1 : 0
      break
    }
    case 'deleteFiscalYear': {
      const used = s.invoices.some((x) => x.fiscalYearId === Number(input.id)) || s.journalVouchers.some((x) => x.fiscalYearId === Number(input.id))
      if (used) throw new Error('این سال مالی در اسناد استفاده شده و قابل حذف نیست؛ آن را ببندید.')
      s.fiscalYears = s.fiscalYears.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'addPerson': {
      if (!String(input.name || '').trim()) throw new Error('نام شخص لازم است.')
      s.persons.unshift({ id: nid(), name: String(input.name).trim(), type: input.type || 'customer', phone: input.phone || '', address: input.address || '', openingBalance: Number(input.openingBalance || 0), active: 1, createdAt: iso() })
      break
    }
    case 'updatePerson': {
      const p = s.persons.find((x) => x.id === Number(input.id))
      if (!p) throw new Error('شخص پیدا نشد.')
      Object.assign(p, { name: String(input.name).trim(), type: input.type, phone: input.phone || '', address: input.address || '', openingBalance: Number(input.openingBalance || 0), active: input.active ? 1 : 0 })
      break
    }
    case 'deletePerson': {
      const used = s.invoices.some((x) => x.personId === Number(input.id)) || s.cashTransactions.some((x) => x.personId === Number(input.id)) || s.cheques.some((x) => x.personId === Number(input.id))
      if (used) throw new Error('این شخص در اسناد استفاده شده؛ آن را غیرفعال کنید.')
      s.persons = s.persons.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'createInvoice': {
      if (!input.items || !input.items.length) throw new Error('فاکتور باید دست‌کم یک قلم داشته باشد.')
      const sign = invoiceSign(input.type)
      let sum = 0
      const items = input.items.map((it) => {
        const p = findProduct(s, it.productId)
        const unitPrice = it.unitPrice === '' || it.unitPrice == null ? p.price : Number(it.unitPrice)
        const total = unitPrice * Number(it.quantity)
        sum += total
        return { id: nid(), productId: p.id, productName: p.name, quantity: Number(it.quantity), unitPrice, total }
      })
      const total = sum - Number(input.discount || 0) + Number(input.tax || 0)
      if (total < 0) throw new Error('جمع فاکتور معتبر نیست.')
      if (sign < 0) for (const it of items) {
        const p = findProduct(s, it.productId)
        if (p.stock < it.quantity) throw new Error(`موجودی «${p.name}» کافی نیست.`)
      }
      for (const it of items) findProduct(s, it.productId).stock += sign * it.quantity
      const person = s.persons.find((x) => x.id === Number(input.personId))
      s.invoices.unshift({ id: nid(), type: input.type, personId: input.personId ? Number(input.personId) : null, personName: person ? person.name : '—', branchId: input.branchId ? Number(input.branchId) : null, fiscalYearId: input.fiscalYearId ? Number(input.fiscalYearId) : null, invoiceDate: input.invoiceDate || iso(), discount: Number(input.discount || 0), tax: Number(input.tax || 0), total, description: input.description || '', createdAt: iso(), items })
      break
    }
    case 'deleteInvoice': {
      const i = s.invoices.findIndex((x) => x.id === Number(input.id))
      if (i < 0) throw new Error('فاکتور پیدا نشد.')
      const inv = s.invoices[i]
      const sign = invoiceSign(inv.type)
      for (const it of inv.items) {
        const p = s.products.find((x) => x.id === it.productId)
        if (p) p.stock -= sign * it.quantity
      }
      s.invoices.splice(i, 1)
      break
    }
    case 'createStockVoucher': {
      if (!input.items || !input.items.length) throw new Error('حواله باید دست‌کم یک قلم داشته باشد.')
      const items = input.items.map((it) => {
        const p = findProduct(s, it.productId)
        if (input.kind === 'output' && p.stock < Number(it.quantity)) throw new Error(`موجودی «${p.name}» کافی نیست.`)
        return { id: nid(), productId: p.id, productName: p.name, quantity: Number(it.quantity) }
      })
      for (const it of items) {
        const p = findProduct(s, it.productId)
        if (input.kind === 'input') p.stock += it.quantity
        if (input.kind === 'output') p.stock -= it.quantity
      }
      s.stockVouchers.unshift({ id: nid(), kind: input.kind, branchId: input.branchId ? Number(input.branchId) : null, reason: String(input.reason || 'حواله'), voucherDate: input.voucherDate || iso(), description: input.description || '', createdAt: iso(), items })
      break
    }
    case 'deleteStockVoucher': {
      const i = s.stockVouchers.findIndex((x) => x.id === Number(input.id))
      if (i < 0) throw new Error('حواله پیدا نشد.')
      const v = s.stockVouchers[i]
      for (const it of v.items) {
        const p = s.products.find((x) => x.id === it.productId)
        if (!p) continue
        if (v.kind === 'input') p.stock -= it.quantity
        if (v.kind === 'output') p.stock += it.quantity
      }
      s.stockVouchers.splice(i, 1)
      break
    }
    case 'addCash': {
      const person = s.persons.find((x) => x.id === Number(input.personId))
      s.cashTransactions.unshift({ id: nid(), kind: input.kind, personId: input.personId ? Number(input.personId) : null, personName: person ? person.name : '—', branchId: input.branchId ? Number(input.branchId) : null, method: input.method || 'cash', amount: Number(input.amount), txnDate: input.txnDate || iso(), description: input.description || '', createdAt: iso() })
      break
    }
    case 'updateCash': {
      const t = s.cashTransactions.find((x) => x.id === Number(input.id))
      if (!t) throw new Error('عملیات پیدا نشد.')
      const person = s.persons.find((x) => x.id === Number(input.personId))
      Object.assign(t, { kind: input.kind, personId: input.personId ? Number(input.personId) : null, personName: person ? person.name : '—', branchId: input.branchId ? Number(input.branchId) : null, method: input.method, amount: Number(input.amount), txnDate: input.txnDate || iso(), description: input.description || '' })
      break
    }
    case 'deleteCash': {
      s.cashTransactions = s.cashTransactions.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'addCheque': {
      const person = s.persons.find((x) => x.id === Number(input.personId))
      s.cheques.unshift({ id: nid(), kind: input.kind, personId: input.personId ? Number(input.personId) : null, personName: person ? person.name : '—', amount: Number(input.amount), chequeNumber: String(input.chequeNumber), bank: input.bank || '', issueDate: input.issueDate || '', dueDate: input.dueDate, status: 'pending', description: input.description || '', createdAt: iso() })
      break
    }
    case 'updateCheque': {
      const c = s.cheques.find((x) => x.id === Number(input.id))
      if (!c) throw new Error('چک پیدا نشد.')
      const person = s.persons.find((x) => x.id === Number(input.personId))
      Object.assign(c, { kind: input.kind, personId: input.personId ? Number(input.personId) : null, personName: person ? person.name : '—', amount: Number(input.amount), chequeNumber: String(input.chequeNumber), bank: input.bank || '', issueDate: input.issueDate || '', dueDate: input.dueDate, status: input.status, description: input.description || '' })
      break
    }
    case 'deleteCheque': {
      s.cheques = s.cheques.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'createJournal': {
      const lines = (input.lines || []).map((l) => ({ id: nid(), accountTitle: String(l.accountTitle).trim(), debit: Number(l.debit || 0), credit: Number(l.credit || 0) }))
      if (lines.length < 2) throw new Error('سند باید دست‌کم دو آرتیکل داشته باشد.')
      const d = lines.reduce((a, l) => a + l.debit, 0)
      const c = lines.reduce((a, l) => a + l.credit, 0)
      if (d <= 0 || d !== c) throw new Error('جمع بدهکار و بستانکار سند باید برابر باشد.')
      s.journalVouchers.unshift({ id: nid(), voucherDate: input.voucherDate || iso(), branchId: input.branchId ? Number(input.branchId) : null, fiscalYearId: input.fiscalYearId ? Number(input.fiscalYearId) : null, description: String(input.description || '').trim(), createdAt: iso(), lines })
      break
    }
    case 'deleteJournal': {
      s.journalVouchers = s.journalVouchers.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'addEmployee': {
      s.employees.unshift({ id: nid(), name: String(input.name).trim(), role: input.role || '', phone: input.phone || '', baseSalary: Number(input.baseSalary || 0), active: 1, createdAt: iso() })
      break
    }
    case 'updateEmployee': {
      const e = s.employees.find((x) => x.id === Number(input.id))
      if (!e) throw new Error('کارمند پیدا نشد.')
      Object.assign(e, { name: String(input.name).trim(), role: input.role || '', phone: input.phone || '', baseSalary: Number(input.baseSalary || 0), active: input.active ? 1 : 0 })
      break
    }
    case 'deleteEmployee': {
      if (s.payrolls.some((x) => x.employeeId === Number(input.id))) throw new Error('این کارمند حقوق ثبت‌شده دارد؛ آن را غیرفعال کنید.')
      s.employees = s.employees.filter((x) => x.id !== Number(input.id))
      break
    }
    case 'addPayroll': {
      const emp = s.employees.find((x) => x.id === Number(input.employeeId))
      if (!emp) throw new Error('کارمند پیدا نشد.')
      const amount = Number(input.amount || 0); const bonus = Number(input.bonus || 0); const deduction = Number(input.deduction || 0)
      s.payrolls.unshift({ id: nid(), employeeId: emp.id, employeeName: emp.name, month: String(input.month), amount, bonus, deduction, net: amount + bonus - deduction, paid: input.paid ? 1 : 0, payrollDate: input.payrollDate || iso(), description: input.description || '', createdAt: iso() })
      break
    }
    case 'updatePayroll': {
      const p = s.payrolls.find((x) => x.id === Number(input.id))
      if (!p) throw new Error('رکورد حقوق پیدا نشد.')
      const amount = Number(input.amount || 0); const bonus = Number(input.bonus || 0); const deduction = Number(input.deduction || 0)
      Object.assign(p, { month: String(input.month), amount, bonus, deduction, net: amount + bonus - deduction, paid: input.paid ? 1 : 0, payrollDate: input.payrollDate || iso(), description: input.description || '' })
      break
    }
    case 'deletePayroll': {
      s.payrolls = s.payrolls.filter((x) => x.id !== Number(input.id))
      break
    }
    default:
      throw new Error('عملیات نامشخص است.')
  }
  touch()
  return s
}

export const isDesktop = () => Boolean(window.avayeAPI)

// فراخوانی یکپارچه: در دسکتاپ از SQLite، در مرورگر از دمو
export async function callStore(state, setState, method, input, onNotice) {
  if (window.avayeAPI && window.avayeAPI[method]) {
    const next = await window.avayeAPI[method](input)
    setState((prev) => ({ ...prev, ...next }))
    return next
  }
  const next = applyDemo(state, method, input)
  setState(next)
  return next
}
