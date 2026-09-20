import { useMemo, useState } from 'react'
import { format, INVOICE_LABEL, Empty, Modal, PersonOptions, BranchOptions, YearOptions } from './ui.jsx'

export function PersonsPage({ persons, invoices, cashTransactions, cheques, onCall, onNotice }) {
  const [form, setForm] = useState({ name: '', type: 'customer', phone: '', address: '', openingBalance: 0 })
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState(null)
  const filtered = useMemo(() => persons.filter((p) => (p.name + (p.phone || '')).includes(query.trim())), [persons, query])
  const balanceOf = (person) => {
    let b = Number(person.openingBalance || 0)
    for (const inv of invoices.filter((x) => x.personId === person.id)) {
      if (inv.type === 'sale') b += inv.total
      if (inv.type === 'sale_return') b -= inv.total
      if (inv.type === 'purchase') b -= inv.total
      if (inv.type === 'purchase_return') b += inv.total
    }
    for (const t of cashTransactions.filter((x) => x.personId === person.id)) b += t.kind === 'receipt' ? t.amount : -t.amount
    return b
  }
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  async function save(e) {
    e.preventDefault()
    try {
      if (editing) await onCall('updatePerson', { ...form, id: editing.id, openingBalance: Number(form.openingBalance || 0), active: form.active ?? true })
      else await onCall('addPerson', { ...form, openingBalance: Number(form.openingBalance || 0) })
      onNotice(editing ? 'طرف‌حساب ویرایش شد.' : 'شخص جدید ثبت شد.')
      setEditing(null); setForm({ name: '', type: 'customer', phone: '', address: '', openingBalance: 0 })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>حسابداری</span><h1>اشخاص و طرف‌حساب‌ها</h1><p>مشتری، تأمین‌کننده، مانده اول دوره و گردش هر شخص. مدیر می‌تواند همه را ویرایش یا غیرفعال کند.</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>{editing ? 'ویرایش طرف‌حساب' : 'شخص جدید'}</h3><p>مانده مثبت یعنی بدهی شخص به فروشگاه.</p>
        <form onSubmit={save}>
          <label>نام<input value={form.name} onChange={(e) => field('name', e.target.value)} required maxLength="120" placeholder="مثلاً نانوایی سپیده" /></label>
          <div className="form-pair">
            <label>نوع<select value={form.type} onChange={(e) => field('type', e.target.value)}><option value="customer">مشتری</option><option value="supplier">تأمین‌کننده</option><option value="both">هر دو</option><option value="other">سایر</option></select></label>
            <label>تلفن<input value={form.phone} onChange={(e) => field('phone', e.target.value)} maxLength="30" /></label>
          </div>
          <label>نشانی<input value={form.address} onChange={(e) => field('address', e.target.value)} maxLength="300" /></label>
          <div className="form-pair">
            <label>مانده اول دوره (تومان)<input type="number" step="1" value={form.openingBalance} onChange={(e) => field('openingBalance', e.target.value)} /></label>
            {editing && <label className="check-label"><input type="checkbox" checked={form.active ?? true} onChange={(e) => field('active', e.target.checked)} /> فعال</label>}
          </div>
          <div className="form-actions"><button className="submit">{editing ? 'ذخیره تغییرات' : '＋ ثبت شخص'}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ name: '', type: 'customer', phone: '', address: '', openingBalance: 0 }) }}>انصراف</button>}</div>
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>فهرست اشخاص</h3><p>{format(persons.length)} طرف‌حساب</p></div><span className="badge">{format(filtered.length)} نتیجه</span></div>
        <input className="product-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی نام یا تلفن" />
        {filtered.length ? <div className="table-scroll"><table><thead><tr><th>نام</th><th>نوع</th><th>مانده حساب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
          {filtered.map((p) => { const b = balanceOf(p); return <tr key={p.id}><td><strong>{p.name}</strong><small className="cell-sub">{p.phone || '—'} · اول دوره: {format(p.openingBalance)} </small></td><td>{({ customer: 'مشتری', supplier: 'تأمین‌کننده', both: 'هر دو', other: 'سایر' })[p.type]}</td><td><b className={b >= 0 ? 'pos' : 'neg'}>{format(b)} تومان</b></td><td>{p.active ? 'فعال' : 'غیرفعال'}</td><td><button className="table-action" onClick={() => setDetail(p)}>گردش</button><button className="table-action" onClick={() => { setEditing(p); setForm({ name: p.name, type: p.type, phone: p.phone || '', address: p.address || '', openingBalance: p.openingBalance, active: Boolean(p.active) }) }}>ویرایش</button><button className="table-action danger" onClick={async () => { if (confirm(`حذف «${p.name}»؟`)) try { await onCall('deletePerson', { id: p.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr> })}
        </tbody></table></div> : <Empty icon="◉" title="شخصی ثبت نشده" hint="از فرم روبه‌رو اولین طرف‌حساب را بساز." />}
      </section>
    </div>
    {detail && <Modal title={`گردش حساب ${detail.name}`} hint={`مانده فعلی: ${format(balanceOf(detail))} تومان`} onClose={() => setDetail(null)}>
      <div className="table-scroll"><table><thead><tr><th>سند</th><th>مبلغ</th></tr></thead><tbody>
        {invoices.filter((x) => x.personId === detail.id).map((x) => <tr key={`i${x.id}`}><td>فاکتور {INVOICE_LABEL[x.type]} #{x.id}</td><td>{format((x.type === 'sale' || x.type === 'purchase_return' ? 1 : -1) * x.total)}</td></tr>)}
        {cashTransactions.filter((x) => x.personId === detail.id).map((x) => <tr key={`c${x.id}`}><td>{x.kind === 'receipt' ? 'دریافت' : 'پرداخت'} #{x.id}</td><td>{format(x.kind === 'receipt' ? x.amount : -x.amount)}</td></tr>)}
        {cheques.filter((x) => x.personId === detail.id).map((x) => <tr key={`q${x.id}`}><td>چک {x.kind === 'receivable' ? 'دریافتی' : 'پرداختی'} {x.chequeNumber}</td><td>{format(x.amount)}</td></tr>)}
      </tbody></table></div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setDetail(null)}>بستن</button></div>
    </Modal>}
  </>
}

export function InvoicesPage({ invoices, persons, products, branches, fiscalYears, onCall, onNotice }) {
  const [type, setType] = useState('sale')
  const [personId, setPersonId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [fiscalYearId, setFiscalYearId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [tax, setTax] = useState(0)
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unitPrice: '' }])
  const [filter, setFilter] = useState('all')
  const shown = invoices.filter((x) => filter === 'all' || x.type === filter)
  const sum = lines.reduce((a, l) => { const p = products.find((x) => x.id === Number(l.productId)); const up = l.unitPrice === '' ? (p?.price || 0) : Number(l.unitPrice || 0); return a + up * Number(l.quantity || 0) }, 0)
  const total = sum - Number(discount || 0) + Number(tax || 0)
  function setLine(i, k, v) { setLines((ls) => ls.map((l, j) => j === i ? { ...l, [k]: v } : l)) }
  async function save(e) {
    e.preventDefault()
    try {
      await onCall('createInvoice', { type, personId: personId || null, branchId: branchId || null, fiscalYearId: fiscalYearId || null, discount: Number(discount || 0), tax: Number(tax || 0), description, items: lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity), unitPrice: l.unitPrice === '' ? undefined : Number(l.unitPrice) })) })
      onNotice(`فاکتور ${INVOICE_LABEL[type]} ثبت و موجودی به‌روز شد.`)
      setLines([{ productId: '', quantity: 1, unitPrice: '' }]); setDiscount(0); setTax(0); setDescription('')
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>حسابداری</span><h1>فاکتور چندقلمی</h1><p>فروش، خرید و برگشتی با چند قلم کالا؛ موجودی انبار خودکار کم و زیاد می‌شود.</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>فاکتور جدید</h3><p>جمع اقلام: {format(sum)} · خالص: {format(total)} تومان</p>
        <form onSubmit={save}>
          <div className="form-pair">
            <label>نوع فاکتور<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(INVOICE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>طرف‌حساب<select value={personId} onChange={(e) => setPersonId(e.target.value)}><PersonOptions persons={persons} /></select></label>
          </div>
          <div className="form-pair">
            <label>شعبه<select value={branchId} onChange={(e) => setBranchId(e.target.value)}><BranchOptions branches={branches} /></select></label>
            <label>سال مالی<select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)}><YearOptions years={fiscalYears} /></select></label>
          </div>
          {lines.map((l, i) => <div key={i} className="invoice-line">
            <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)} required><option value="">— کالا —</option>{products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} (موجودی {p.stock})</option>)}</select>
            <input type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} title="تعداد" required />
            <input type="number" min="0" step="1" value={l.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} title="قیمت واحد (خالی = قیمت فروش)" placeholder="قیمت" />
            {lines.length > 1 && <button type="button" className="table-action danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button>}
          </div>)}
          <button type="button" className="secondary-button" onClick={() => setLines((ls) => [...ls, { productId: '', quantity: 1, unitPrice: '' }])}>＋ افزودن قلم</button>
          <div className="form-pair">
            <label>تخفیف<input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
            <label>مالیات<input type="number" min="0" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
          </div>
          <label>شرح<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength="500" placeholder="توضیح فاکتور" /></label>
          <div className="form-actions"><button className="submit">ثبت فاکتور · {format(total)} تومان</button></div>
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>فاکتورها</h3><p>{format(shown.length)} سند</p></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">همه</option>{Object.entries(INVOICE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {shown.length ? <div className="table-scroll"><table><thead><tr><th>شماره / نوع</th><th>طرف‌حساب</th><th>اقلام</th><th>خالص</th><th>عملیات</th></tr></thead><tbody>
          {shown.map((inv) => <tr key={inv.id}><td><strong>#{inv.id} · {INVOICE_LABEL[inv.type]}</strong><small className="cell-sub">{inv.items.map((it) => `${it.productName} ×${it.quantity}`).join('، ')}</small></td><td>{inv.personName}</td><td>{format(inv.items.length)} قلم</td><td>{format(inv.total)} تومان</td><td><button className="table-action danger" onClick={async () => { if (confirm(`حذف فاکتور #${inv.id} و برگشت موجودی؟`)) try { await onCall('deleteInvoice', { id: inv.id }); onNotice('فاکتور حذف و موجودی برگشت.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}
        </tbody></table></div> : <Empty title="فاکتوری ثبت نشده" hint="از فرم روبه‌رو اولین فاکتور چندقلمی را بساز." />}
      </section>
    </div>
  </>
}

export function InventoryPage({ vouchers, movements, products, branches, onCall, onNotice }) {
  const [kind, setKind] = useState('input')
  const [reason, setReason] = useState('')
  const [branchId, setBranchId] = useState('')
  const [lines, setLines] = useState([{ productId: '', quantity: 1 }])
  async function save(e) {
    e.preventDefault()
    try {
      await onCall('createStockVoucher', { kind, reason, branchId: branchId || null, items: lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity) })) })
      onNotice('حواله انبار ثبت و موجودی به‌روز شد.')
      setLines([{ productId: '', quantity: 1 }]); setReason('')
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>انبار</span><h1>حواله و گردش انبار</h1><p>رسید، خروج و انتقال؛ هر ثبت موجودی را تغییر می‌دهد و در گردش کالا دیده می‌شود.</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>حواله جدید</h3>
        <form onSubmit={save}>
          <div className="form-pair">
            <label>نوع حواله<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="input">رسید انبار (افزایش)</option><option value="output">حواله خروج (کاهش)</option><option value="transfer">انتقال بین شعبه (بدون تغییر جمع)</option></select></label>
            <label>شعبه<select value={branchId} onChange={(e) => setBranchId(e.target.value)}><BranchOptions branches={branches} /></select></label>
          </div>
          <label>دلیل حواله<input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="مثلاً خرید آرد، ضایعات، انبارگردانی" /></label>
          {lines.map((l, i) => <div key={i} className="invoice-line">
            <select value={l.productId} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, productId: e.target.value } : x))} required><option value="">— کالا —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (موجودی {p.stock})</option>)}</select>
            <input type="number" min="1" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} required />
            {lines.length > 1 && <button type="button" className="table-action danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button>}
          </div>)}
          <button type="button" className="secondary-button" onClick={() => setLines((ls) => [...ls, { productId: '', quantity: 1 }])}>＋ افزودن قلم</button>
          <div className="form-actions"><button className="submit">ثبت حواله</button></div>
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>حواله‌ها</h3><p>{format(vouchers.length)} حواله</p></div></div>
        {vouchers.length ? <div className="table-scroll"><table><thead><tr><th>حواله</th><th>اقلام</th><th>عملیات</th></tr></thead><tbody>
          {vouchers.map((v) => <tr key={v.id}><td><strong>#{v.id} · {({ input: 'رسید', output: 'خروج', transfer: 'انتقال' })[v.kind]}</strong><small className="cell-sub">{v.reason} · {v.items.map((it) => `${it.productName} ×${it.quantity}`).join('، ')}</small></td><td>{format(v.items.length)} قلم</td><td><button className="table-action danger" onClick={async () => { if (confirm(`حذف حواله #${v.id}؟`)) try { await onCall('deleteStockVoucher', { id: v.id }); onNotice('حواله حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}
        </tbody></table></div> : <Empty title="حواله‌ای ثبت نشده" hint="اولین رسید یا خروج انبار را ثبت کن." />}
        <div className="card-head" style={{ marginTop: 18 }}><div><h3>آخرین گردش کالا</h3><p>۳۰۰ حرکت اخیر</p></div></div>
        {movements.length ? <div className="table-scroll"><table><thead><tr><th>کالا</th><th>تغییر</th><th>دلیل</th></tr></thead><tbody>{movements.slice(0, 60).map((m) => <tr key={m.id}><td>{m.productName || '—'}</td><td><b className={m.changeAmount >= 0 ? 'pos' : 'neg'}>{format(m.changeAmount)}</b></td><td>{m.reason}</td></tr>)}</tbody></table></div> : <Empty title="گردشی ثبت نشده" hint="با ثبت فاکتور یا حواله، گردش ساخته می‌شود." />}
      </section>
    </div>
  </>
}
