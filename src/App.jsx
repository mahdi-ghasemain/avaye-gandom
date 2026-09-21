import { useEffect, useMemo, useState } from 'react'
import basket from './assets/bread-basket.jpg'
import ProductsPage from './ProductsPage.jsx'
import { PersonsPage, InvoicesPage, InventoryPage } from './pages/personsInvoicesStock.jsx'
import { CashPage, ChequesPage, JournalPage, OrgPage, PayrollPage } from './pages/cashChequeJournalOrgPayroll.jsx'
import { loadDemoState, applyDemo } from './storeClient.js'
import { format } from './pages/ui.jsx'
import Icon from './Icons.jsx'
import './App.css'
import './accounting.css'

const menu = [
  ['home', 'home', 'نمای کلی'],
  ['sales', 'sales', 'ثبت فروش'],
  ['invoices', 'invoices', 'فاکتورها'],
  ['products', 'products', 'محصولات'],
  ['inventory', 'inventory', 'انبار'],
  ['persons', 'persons', 'اشخاص'],
  ['cash', 'cash', 'دریافت و پرداخت'],
  ['cheques', 'cheques', 'چک‌ها'],
  ['journal', 'journal', 'سند حسابداری'],
  ['payroll', 'payroll', 'حقوق و دستمزد'],
  ['org', 'org', 'شعبه و سال مالی'],
  ['expenses', 'expenses', 'هزینه‌ها'],
  ['reports', 'reports', 'گزارش‌ها'],
]
const date = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
const EMPTY = { products: [], sales: [], expenses: [], branches: [], fiscalYears: [], persons: [], invoices: [], stockVouchers: [], cashTransactions: [], cheques: [], journalVouchers: [], employees: [], payrolls: [], stockMovements: [] }

function App() {
  const desktop = Boolean(window.avayeAPI)
  const [page, setPage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebar-open') !== 'false')
  const [state, setState] = useState(EMPTY)
  const [notice, setNotice] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [expenseName, setExpenseName] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(desktop)
  const { products, sales, expenses, invoices, cashTransactions, cheques, payrolls } = state
  const selected = products.find((item) => item.id === Number(productId))
  const isToday = (item) => item.createdAt && new Date(item.createdAt).toDateString() === new Date().toDateString()
  const todaySales = sales.filter(isToday)
  const todayExpenses = expenses.filter(isToday)
  const revenue = todaySales.reduce((sum, item) => sum + item.total, 0)
  const spent = todayExpenses.reduce((sum, item) => sum + item.amount, 0)
  const invoiceRevenue = invoices.filter((x) => x.type === 'sale').reduce((a, x) => a + x.total, 0)
  const invoiceCost = invoices.filter((x) => x.type === 'purchase').reduce((a, x) => a + x.total, 0)
  const cashIn = cashTransactions.filter((t) => t.kind === 'receipt').reduce((a, t) => a + t.amount, 0)
  const cashOut = cashTransactions.filter((t) => t.kind === 'payment').reduce((a, t) => a + t.amount, 0)
  const pendingCheques = useMemo(() => cheques.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0), [cheques])
  const unpaidPayroll = payrolls.filter((p) => !p.paid).reduce((a, p) => a + p.net, 0)
  const lowStock = products.filter((p) => p.stock <= (p.minStock || 0))

  function applyState(next) {
    setState((prev) => ({ ...prev, ...next }))
    const list = next.products || state.products
    if (list) setProductId((current) => list.some((item) => item.id === Number(current) && item.active) ? current : (list.find((item) => item.active)?.id ?? ''))
  }

  async function onCall(method, input) {
    if (window.avayeAPI && window.avayeAPI[method]) {
      const next = await window.avayeAPI[method](input)
      applyState(next)
      return next
    }
    const next = applyDemo(state, method, input)
    setState(next)
    const list = next.products
    if (list) setProductId((current) => list.some((item) => item.id === Number(current) && item.active) ? current : (list.find((item) => item.active)?.id ?? ''))
    return next
  }

  useEffect(() => {
    if (!window.avayeAPI) { setState(loadDemoState()); return }
    window.avayeAPI.getState().then(applyState).catch((error) => setNotice(`خطا در خواندن اطلاعات: ${error.message}`)).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addSale(event) {
    event.preventDefault()
    const count = Number(quantity)
    if (!selected || !Number.isInteger(count) || count < 1 || count > selected.stock) return
    try {
      if (desktop) applyState(await window.avayeAPI.addSale({ productId: selected.id, quantity: count }))
      else {
        const next = applyDemo(state, 'addSale', { productId: selected.id, quantity: count })
        setState(next)
      }
      setQuantity(1); setNotice('فروش ثبت شد.')
    } catch (error) { setNotice(`خطا: ${error.message}`) }
  }
  async function addExpense(event) {
    event.preventDefault()
    const value = Number(amount)
    if (!expenseName.trim() || !Number.isFinite(value) || value <= 0) return
    try {
      if (desktop) applyState(await window.avayeAPI.addExpense({ name: expenseName, amount: value }))
      else setState(applyDemo(state, 'addExpense', { name: expenseName, amount: value }))
      setExpenseName(''); setAmount(''); setNotice('هزینه ثبت شد.')
    } catch (error) { setNotice(`خطا: ${error.message}`) }
  }
  async function backupData() {
    try { const saved = await window.avayeAPI.backup(); if (saved) setNotice(`نسخهٔ پشتیبان ذخیره شد: ${saved}`) }
    catch (error) { setNotice(`خطا در پشتیبان‌گیری: ${error.message}`) }
  }
  async function restoreData() {
    try { const next = await window.avayeAPI.restore(); if (next) { applyState(next); setNotice('اطلاعات از نسخهٔ پشتیبان بازگردانده شد.') } }
    catch (error) { setNotice(`خطا در بازیابی: ${error.message}`) }
  }
  function navigate(next) { setPage(next); setNotice('') }
  function toggleSidebar() { setSidebarOpen((open) => { localStorage.setItem('sidebar-open', String(!open)); return !open }) }

  if (loading) return <div className="loading" dir="rtl">در حال بارگذاری اطلاعات آوای گندم…</div>

  return <div className={`shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`} dir="rtl">
    <aside className="sidebar" aria-label="نوار کناری">
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarOpen ? 'جمع کردن منو' : 'باز کردن منو'} title={sidebarOpen ? 'جمع کردن منو' : 'باز کردن منو'}><Icon name={sidebarOpen ? 'close' : 'menu'} size={19} /></button>
      <div className="brand"><span className="brand-logo"><img src={basket} alt="سبد نان آوای گندم" /></span><div><strong>آوای گندم</strong><small>حسابداری فروشگاه</small></div></div>
      <span className="nav-label">فضای کار</span>
      <nav aria-label="منوی اصلی">{menu.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)} title={!sidebarOpen ? label : undefined}><span><Icon name={icon} /></span><em>{label}</em></button>)}</nav>
      <div className="shop"><span className="shop-icon"><img src={basket} alt="سبد نان" /></span><div><strong>فروشگاه آوای گندم</strong><small>{desktop ? 'ذخیرهٔ محلی SQLite' : 'نسخهٔ نمایشی مرورگر'}</small></div><i /></div>
    </aside>
    <main>
      <header><span className="header-title"><button className="mobile-menu" onClick={toggleSidebar} aria-label="نمایش منو"><Icon name="menu" /></button>آوای گندم <b>/</b> {menu.find(([id]) => id === page)?.[2]}</span><div><span className="date">◷ &nbsp; {date}</span><span className="demo">● &nbsp; {desktop ? 'نسخهٔ کامل حسابداری' : 'نمایش مرورگر؛ بدون ذخیره دائم'}</span></div></header>
      <div className="content">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="بستن پیام">×</button></div>}
        {page === 'home' && <>
          <section className="hero"><div><span>پنل مدیریت فروشگاه</span><h1>سلام، خوش آمدی 👋</h1><p>همهٔ بخش‌های حسابداری فعال است: فاکتور چندقلمی، انبار، چک، سند دوبل، حقوق، شعبه و سال مالی.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button onClick={() => navigate('sales')}>＋ &nbsp; ثبت فروش جدید</button><button className="secondary-button" onClick={() => navigate('invoices')}>فاکتور چندقلمی</button></div></div><div className="hero-art"><img src={basket} alt="سبد نان آوای گندم" /></div></section>
          <div className="section-title"><div><h2>خلاصهٔ امروز</h2><p>اطلاعات ثبت‌شده برای امروز</p></div><span>{date}</span></div>
          <div className="stats"><Stat icon="◫" label="فروش امروز" value={revenue} unit="تومان" color="green" /><Stat icon="◇" label="هزینه‌های امروز" value={spent} unit="تومان" color="orange" /><Stat icon="💰" label="خالص صندوق" value={cashIn - cashOut} unit="تومان" color="blue" /><Stat icon="◈" label="محصولات" value={products.length} unit="محصول" color="purple" /></div>
          <div className="stats"><Stat icon="🧾" label="فروش فاکتوری" value={invoiceRevenue} unit="تومان" color="green" /><Stat icon="📦" label="خرید فاکتوری" value={invoiceCost} unit="تومان" color="orange" /><Stat icon="✉" label="چک نزد صندوق" value={pendingCheques} unit="تومان" color="blue" /><Stat icon="👥" label="حقوق پرداخت‌نشده" value={unpaidPayroll} unit="تومان" color="purple" /></div>
          {lowStock.length > 0 && <div className="report-note warn"><strong>⚠ &nbsp; هشدار کسری موجودی ({format(lowStock.length)} کالا)</strong><p>{lowStock.slice(0, 5).map((p) => `${p.name} (${format(p.stock)})`).join('، ')}{lowStock.length > 5 ? ' و موارد بیشتر…' : ''}</p></div>}
          <div className="home-grid"><section className="card"><div className="card-head"><div><h3>آخرین فروش‌ها</h3><p>فروش‌های ثبت‌شدهٔ امروز</p></div><button className="link" onClick={() => navigate('sales')}>مشاهده همه ←</button></div><ItemList items={todaySales.slice(0, 4)} type="sale" empty="هنوز فروشی ثبت نشده" /></section>
          <section className="card shortcuts"><div className="card-head"><div><h3>دسترسی سریع</h3><p>همهٔ بخش‌ها فعال‌اند</p></div></div>{[['invoices', '🧾', 'فاکتور چندقلمی', 'فروش، خرید و برگشتی'], ['persons', '◉', 'اشخاص و طرف‌حساب', 'مشتری و تأمین‌کننده'], ['inventory', '📦', 'حواله و گردش انبار', 'رسید، خروج و انتقال'], ['cash', '💰', 'دریافت و پرداخت', 'نقد، کارت و حواله'], ['cheques', '✉', 'چک‌ها', 'سررسید و وصول'], ['journal', '📒', 'سند حسابداری', 'سند دوبل متوازن'], ['payroll', '👥', 'حقوق و دستمزد', 'پرسنل و حقوق ماهانه'], ['org', '🏢', 'شعبه و سال مالی', 'چندشعبه و بستن سال']].map(([id, icon, title, text]) => <button key={id} onClick={() => navigate(id)}><span className="shortcut-icon">{icon}</span><span><strong>{title}</strong><small>{text}</small></span><span>←</span></button>)}</section></div>
        </>}
        {page === 'products' && <ProductsPage products={products} desktop={false} onChange={(patch) => setState((p) => ({ ...p, ...patch }))} onNotice={setNotice} onCall={onCall} />}
        {page === 'sales' && <><PageTitle title="ثبت فروش" subtitle="فروش‌های روز را سریع و ساده ثبت کن" /><div className="workspace-grid"><section className="card form-card"><h3>فروش جدید</h3><p>محصول و تعداد را انتخاب کن.</p><form onSubmit={addSale}><label>محصول<select value={productId} onChange={(e) => setProductId(e.target.value)}>{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} — {format(item.price)} تومان</option>)}</select></label><label>تعداد<input type="number" min="1" max={selected?.stock || 1} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label><div className="total"><span>مبلغ کل</span><strong>{format((selected?.price || 0) * (Number(quantity) || 0))} تومان</strong></div><p>موجودی: {format(selected?.stock || 0)} عدد</p><button className="submit" disabled={!selected?.stock}>ثبت فروش</button></form></section><section className="card"><div className="card-head"><h3>فروش‌های ثبت‌شده</h3><span className="badge">{format(sales.length)} فاکتور</span></div><div className="items">{sales.map((item) => <div className="item" key={item.id}><span className="item-icon">◫</span><div><strong>{item.name}</strong><small>{format(item.quantity)} عدد</small></div><b>{format(item.total)} تومان</b><button className="table-action danger" onClick={async () => { if (confirm('حذف این فروش و برگشت موجودی؟')) try { await onCall('deleteSale', { id: item.id }); setNotice('فروش حذف و موجودی برگشت.') } catch (e) { setNotice(`خطا: ${e.message}`) } }}>حذف</button></div>)}</div></section></div></>}
        {page === 'invoices' && <InvoicesPage invoices={state.invoices} persons={state.persons} products={products} branches={state.branches} fiscalYears={state.fiscalYears} onCall={onCall} onNotice={setNotice} />}
        {page === 'inventory' && <InventoryPage vouchers={state.stockVouchers} movements={state.stockMovements} products={products} branches={state.branches} onCall={onCall} onNotice={setNotice} />}
        {page === 'persons' && <PersonsPage persons={state.persons} invoices={state.invoices} cashTransactions={state.cashTransactions} cheques={state.cheques} onCall={onCall} onNotice={setNotice} />}
        {page === 'cash' && <CashPage transactions={state.cashTransactions} persons={state.persons} branches={state.branches} onCall={onCall} onNotice={setNotice} />}
        {page === 'cheques' && <ChequesPage cheques={state.cheques} persons={state.persons} onCall={onCall} onNotice={setNotice} />}
        {page === 'journal' && <JournalPage journals={state.journalVouchers} branches={state.branches} fiscalYears={state.fiscalYears} onCall={onCall} onNotice={setNotice} />}
        {page === 'payroll' && <PayrollPage employees={state.employees} payrolls={state.payrolls} onCall={onCall} onNotice={setNotice} />}
        {page === 'org' && <OrgPage branches={state.branches} fiscalYears={state.fiscalYears} onCall={onCall} onNotice={setNotice} />}
        {page === 'expenses' && <><PageTitle title="هزینه‌ها" subtitle="هزینه‌های روزانهٔ فروشگاه را ثبت و ویرایش کن" /><div className="workspace-grid"><section className="card form-card"><h3>هزینهٔ جدید</h3><p>عنوان و مبلغ هزینه را وارد کن.</p><form onSubmit={addExpense}><label>عنوان هزینه<input value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="مثلاً خرید آرد" required /></label><label>مبلغ (تومان)<input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label><button className="submit">＋ ثبت هزینه</button></form></section><section className="card"><div className="card-head"><h3>هزینه‌های ثبت‌شده</h3><span className="badge">{format(expenses.length)} مورد</span></div><div className="items">{expenses.map((item) => <div className="item" key={item.id}><span className="item-icon">◇</span><div><strong>{item.name}</strong><small>هزینه</small></div><b>{format(item.amount)} تومان</b><button className="table-action danger" onClick={async () => { if (confirm('حذف این هزینه؟')) try { await onCall('deleteExpense', { id: item.id }); setNotice('هزینه حذف شد.') } catch (e) { setNotice(`خطا: ${e.message}`) } }}>حذف</button></div>)}</div></section></div></>}
        {page === 'reports' && <ReportsPage state={state} revenue={revenue} spent={spent} backupData={backupData} restoreData={restoreData} desktop={desktop} />}
      </div>
    </main>
  </div>
}

function ReportsPage({ state, revenue, spent, backupData, restoreData, desktop }) {
  const salesTotal = state.sales.reduce((a, s) => a + s.total, 0) + state.invoices.filter((x) => x.type === 'sale').reduce((a, x) => a + x.total, 0)
  const purchaseTotal = state.invoices.filter((x) => x.type === 'purchase').reduce((a, x) => a + x.total, 0)
  const expenseTotal = state.expenses.reduce((a, e) => a + e.amount, 0)
  const payrollPaid = state.payrolls.filter((p) => p.paid).reduce((a, p) => a + p.net, 0)
  const profit = salesTotal - purchaseTotal - expenseTotal - payrollPaid
  const debitSum = state.journalVouchers.flatMap((j) => j.lines).reduce((a, l) => a + l.debit, 0)
  const creditSum = state.journalVouchers.flatMap((j) => j.lines).reduce((a, l) => a + l.credit, 0)
  return <><PageTitle title="گزارش‌ها" subtitle="سود و زیان ساده، تراز صندوق و پشتیبان‌گیری" />
    <div className="stats report-stats"><Stat icon="◫" label="جمع فروش (تکی + فاکتوری)" value={salesTotal} unit="تومان" color="green" /><Stat icon="📦" label="جمع خرید فاکتوری" value={purchaseTotal} unit="تومان" color="orange" /><Stat icon="◇" label="هزینه + حقوق پرداختی" value={expenseTotal + payrollPaid} unit="تومان" color="orange" /><Stat icon="▤" label="سود ناخالص ساده" value={profit} unit="تومان" color="blue" /></div>
    <div className="stats"><Stat icon="📒" label="جمع بدهکار اسناد" value={debitSum} unit="تومان" color="purple" /><Stat icon="📒" label="جمع بستانکار اسناد" value={creditSum} unit="تومان" color="purple" /><Stat icon={debitSum === creditSum ? '✓' : '×'} label="تراز اسناد دوبل" value={debitSum === creditSum ? 1 : 0} unit={debitSum === creditSum ? 'متوازن' : 'نامتوازن'} color={debitSum === creditSum ? 'green' : 'orange'} /><Stat icon="◫" label="فروش امروز" value={revenue} unit="تومان" color="green" /></div>
    <div className="report-note"><strong>ⓘ &nbsp; گزارش مدیریتی ساده</strong><p>سود = فروش − خرید فاکتوری − هزینه − حقوق پرداختی. مانده دقیق صندوق و ترازنامه رسمی را حسابدار باید با اسناد دوبل بازبینی کند. جمع امروز: فروش {format(revenue)} و هزینه {format(spent)}.</p></div>
    {state.products.length > 0 && <section className="card"><div className="card-head"><div><h3>سود تقریبی هر کالا</h3><p>بر اساس قیمت خرید و فروش ثبت‌شده</p></div></div><div className="table-scroll"><table><thead><tr><th>کالا</th><th>خرید</th><th>فروش</th><th>حاشیه</th><th>موجودی</th></tr></thead><tbody>{state.products.slice(0, 30).map((p) => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{format(p.purchasePrice || 0)}</td><td>{format(p.price)}</td><td><b className={(p.price - (p.purchasePrice || 0)) >= 0 ? 'pos' : 'neg'}>{format(p.price - (p.purchasePrice || 0))}</b></td><td>{format(p.stock)}</td></tr>)}</tbody></table></div></section>}
    <section className="card backup-card"><h3>پشتیبان‌گیری از اطلاعات</h3><p>نسخهٔ پشتیبان را در محل جداگانه‌ای نگه دار. بازیابی، اطلاعات فعلی را با فایل انتخابی جایگزین می‌کند.</p><div><button className="submit" onClick={backupData} disabled={!desktop}>دریافت نسخهٔ پشتیبان</button><button className="secondary-button" onClick={restoreData} disabled={!desktop}>بازگرداندن پشتیبان</button></div>{!desktop && <small>پشتیبان‌گیری در برنامهٔ نصب‌شدهٔ ویندوز فعال است؛ در مرورگر داده‌ها در همین دستگاه می‌ماند.</small>}</section></>
}

function Stat({ icon, label, value, unit, color }) { return <div className="stat"><span className={`stat-icon ${color}`}>{icon}</span><small>{label}</small><div><strong>{format(value)}</strong> <small>{unit}</small></div></div> }
function PageTitle({ title, subtitle }) { return <div className="page-title"><span>مدیریت فروشگاه</span><h1>{title}</h1><p>{subtitle}</p></div> }
function ItemList({ items, type, empty }) { return items.length ? <div className="items">{items.map((item) => <div className="item" key={item.id}><span className="item-icon">{type === 'sale' ? '◫' : '◇'}</span><div><strong>{item.name}</strong><small>{type === 'sale' ? `${format(item.quantity)} عدد` : 'امروز'}</small></div><b>{format(type === 'sale' ? item.total : item.amount)} تومان</b></div>)}</div> : <div className="empty"><span>▤</span><strong>{empty}</strong><p>اولین مورد را ثبت کن تا اینجا نمایش داده شود.</p></div> }

export default App
