import { useMemo, useState } from 'react'
import { format, CASH_LABEL, METHOD_LABEL, CHEQUE_LABEL, Empty, Modal, PersonOptions, BranchOptions, YearOptions } from './ui.jsx'

export function CashPage({ transactions, persons, branches, onCall, onNotice }) {
  const [form, setForm] = useState({ kind: 'receipt', personId: '', branchId: '', method: 'cash', amount: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const shown = transactions.filter((t) => filter === 'all' || t.kind === filter)
  const sumIn = transactions.filter((t) => t.kind === 'receipt').reduce((a, t) => a + t.amount, 0)
  const sumOut = transactions.filter((t) => t.kind === 'payment').reduce((a, t) => a + t.amount, 0)
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  async function save(e) {
    e.preventDefault()
    try {
      const payload = { ...form, personId: form.personId || null, branchId: form.branchId || null, amount: Number(form.amount) }
      if (editing) await onCall('updateCash', { ...payload, id: editing.id })
      else await onCall('addCash', payload)
      onNotice(editing ? 'ویرایش شد.' : 'دریافت/پرداخت ثبت شد.')
      setEditing(null); setForm({ kind: 'receipt', personId: '', branchId: '', method: 'cash', amount: '', description: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>حسابداری</span><h1>دریافت و پرداخت</h1><p>نقد، کارتخوان، حواله بانکی و چک؛ مدیر می‌تواند هر سند را ویرایش یا حذف کند.</p></div>
    <div className="stats">
      <div className="stat"><span className="stat-icon green">↓</span><small>جمع دریافت‌ها</small><div><strong>{format(sumIn)}</strong> <small>تومان</small></div></div>
      <div className="stat"><span className="stat-icon orange">↑</span><small>جمع پرداخت‌ها</small><div><strong>{format(sumOut)}</strong> <small>تومان</small></div></div>
      <div className="stat"><span className="stat-icon blue">▤</span><small>خالص صندوق</small><div><strong>{format(sumIn - sumOut)}</strong> <small>تومان</small></div></div>
    </div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>{editing ? 'ویرایش عملیات' : 'عملیات جدید'}</h3>
        <form onSubmit={save}>
          <div className="form-pair">
            <label>نوع<select value={form.kind} onChange={(e) => field('kind', e.target.value)}><option value="receipt">دریافت</option><option value="payment">پرداخت</option></select></label>
            <label>روش<select value={form.method} onChange={(e) => field('method', e.target.value)}><option value="cash">نقد</option><option value="card">کارتخوان</option><option value="bank_transfer">حواله بانکی</option><option value="cheque">چک</option></select></label>
          </div>
          <div className="form-pair">
            <label>طرف‌حساب<select value={form.personId} onChange={(e) => field('personId', e.target.value)}><PersonOptions persons={persons} /></select></label>
            <label>شعبه<select value={form.branchId} onChange={(e) => field('branchId', e.target.value)}><BranchOptions branches={branches} /></select></label>
          </div>
          <label>مبلغ (تومان)<input type="number" min="1" value={form.amount} onChange={(e) => field('amount', e.target.value)} required /></label>
          <label>شرح<input value={form.description} onChange={(e) => field('description', e.target.value)} maxLength="500" placeholder="مثلاً تسویه فاکتور" /></label>
          <div className="form-actions"><button className="submit">{editing ? 'ذخیره تغییرات' : 'ثبت'}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ kind: 'receipt', personId: '', branchId: '', method: 'cash', amount: '', description: '' }) }}>انصراف</button>}</div>
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>صورت صندوق</h3><p>{format(shown.length)} عملیات</p></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">همه</option><option value="receipt">دریافت</option><option value="payment">پرداخت</option></select></div>
        {shown.length ? <div className="table-scroll"><table><thead><tr><th>عملیات</th><th>طرف‌حساب</th><th>مبلغ</th><th>عملیات مدیر</th></tr></thead><tbody>
          {shown.map((t) => <tr key={t.id}><td><strong>{CASH_LABEL[t.kind]} · {METHOD_LABEL[t.method]}</strong><small className="cell-sub">{t.description || '—'}</small></td><td>{t.personName || '—'}</td><td><b className={t.kind === 'receipt' ? 'pos' : 'neg'}>{t.kind === 'receipt' ? '+' : '−'}{format(t.amount)}</b></td><td><button className="table-action" onClick={() => { setEditing(t); setForm({ kind: t.kind, personId: t.personId || '', branchId: t.branchId || '', method: t.method, amount: t.amount, description: t.description || '' }) }}>ویرایش</button><button className="table-action danger" onClick={async () => { if (confirm('حذف این عملیات؟')) try { await onCall('deleteCash', { id: t.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}
        </tbody></table></div> : <Empty title="عملیاتی ثبت نشده" hint="اولین دریافت یا پرداخت را ثبت کن." />}
      </section>
    </div>
  </>
}

export function ChequesPage({ cheques, persons, onCall, onNotice }) {
  const [form, setForm] = useState({ kind: 'receivable', personId: '', amount: '', chequeNumber: '', bank: '', dueDate: '', issueDate: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [statusForm, setStatusForm] = useState(null)
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const pending = cheques.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0)
  async function save(e) {
    e.preventDefault()
    try {
      const payload = { ...form, personId: form.personId || null, amount: Number(form.amount) }
      if (editing) await onCall('updateCheque', { ...payload, id: editing.id, status: editing.status })
      else await onCall('addCheque', payload)
      onNotice(editing ? 'چک ویرایش شد.' : 'چک ثبت شد.')
      setEditing(null); setForm({ kind: 'receivable', personId: '', amount: '', chequeNumber: '', bank: '', dueDate: '', issueDate: '', description: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>حسابداری</span><h1>چک‌ها</h1><p>چک دریافتی و پرداختی با سررسید و وضعیت وصول؛ جمع نزد صندوق: {format(pending)} تومان</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>{editing ? 'ویرایش چک' : 'چک جدید'}</h3>
        <form onSubmit={save}>
          <div className="form-pair">
            <label>نوع چک<select value={form.kind} onChange={(e) => field('kind', e.target.value)}><option value="receivable">دریافتی</option><option value="payable">پرداختی</option></select></label>
            <label>طرف‌حساب<select value={form.personId} onChange={(e) => field('personId', e.target.value)}><PersonOptions persons={persons} /></select></label>
          </div>
          <div className="form-pair">
            <label>مبلغ<input type="number" min="1" value={form.amount} onChange={(e) => field('amount', e.target.value)} required /></label>
            <label>شماره چک<input value={form.chequeNumber} onChange={(e) => field('chequeNumber', e.target.value)} required /></label>
          </div>
          <div className="form-pair">
            <label>بانک<input value={form.bank} onChange={(e) => field('bank', e.target.value)} /></label>
            <label>سررسید<input value={form.dueDate} onChange={(e) => field('dueDate', e.target.value)} required placeholder="1405/02/15" /></label>
          </div>
          <label>تاریخ صدور<input value={form.issueDate} onChange={(e) => field('issueDate', e.target.value)} placeholder="اختیاری" /></label>
          <label>شرح<input value={form.description} onChange={(e) => field('description', e.target.value)} /></label>
          <div className="form-actions"><button className="submit">{editing ? 'ذخیره تغییرات' : 'ثبت چک'}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ kind: 'receivable', personId: '', amount: '', chequeNumber: '', bank: '', dueDate: '', issueDate: '', description: '' }) }}>انصراف</button>}</div>
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>دفتر چک</h3><p>{format(cheques.length)} چک</p></div></div>
        {cheques.length ? <div className="table-scroll"><table><thead><tr><th>چک</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
          {cheques.map((c) => <tr key={c.id}><td><strong>{c.kind === 'receivable' ? 'دریافتی' : 'پرداختی'} · {c.chequeNumber}</strong><small className="cell-sub">{c.personName || '—'} · سررسید {c.dueDate} · {c.bank || '—'}</small></td><td>{format(c.amount)}</td><td><span className={`pill ${c.status}`}>{CHEQUE_LABEL[c.status]}</span></td><td><button className="table-action" onClick={() => setStatusForm(c)}>تغییر وضعیت</button><button className="table-action" onClick={() => { setEditing(c); setForm({ kind: c.kind, personId: c.personId || '', amount: c.amount, chequeNumber: c.chequeNumber, bank: c.bank || '', dueDate: c.dueDate, issueDate: c.issueDate || '', description: c.description || '' }) }}>ویرایش</button><button className="table-action danger" onClick={async () => { if (confirm('حذف چک؟')) try { await onCall('deleteCheque', { id: c.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}
        </tbody></table></div> : <Empty title="چکی ثبت نشده" hint="اولین چک دریافتی یا پرداختی را ثبت کن." />}
      </section>
    </div>
    {statusForm && <Modal title={`وضعیت چک ${statusForm.chequeNumber}`} hint="وصول، برگشتی، خرج‌شده یا عودت را انتخاب کن." onClose={() => setStatusForm(null)}>
      <div className="status-grid">{Object.entries(CHEQUE_LABEL).map(([v, l]) => <button key={v} className={statusForm.status === v ? 'submit' : 'secondary-button'} onClick={async () => { try { await onCall('updateCheque', { id: statusForm.id, kind: statusForm.kind, personId: statusForm.personId, amount: statusForm.amount, chequeNumber: statusForm.chequeNumber, bank: statusForm.bank || '', issueDate: statusForm.issueDate || '', dueDate: statusForm.dueDate, status: v, description: statusForm.description || '' }); onNotice(`وضعیت چک «${l}» شد.`); setStatusForm(null) } catch (err) { onNotice(`خطا: ${err.message}`) } }}>{l}</button>)}</div>
      <div className="form-actions"><button className="secondary-button" onClick={() => setStatusForm(null)}>بستن</button></div>
    </Modal>}
  </>
}

export function JournalPage({ journals, branches, fiscalYears, onCall, onNotice }) {
  const [description, setDescription] = useState('')
  const [branchId, setBranchId] = useState('')
  const [fiscalYearId, setFiscalYearId] = useState('')
  const [lines, setLines] = useState([{ accountTitle: '', debit: '', credit: '' }, { accountTitle: '', debit: '', credit: '' }])
  const d = lines.reduce((a, l) => a + Number(l.debit || 0), 0)
  const c = lines.reduce((a, l) => a + Number(l.credit || 0), 0)
  const balanced = d > 0 && d === c
  async function save(e) {
    e.preventDefault()
    try {
      await onCall('createJournal', { description, branchId: branchId || null, fiscalYearId: fiscalYearId || null, lines: lines.map((l) => ({ accountTitle: l.accountTitle, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) })
      onNotice('سند حسابداری متوازن ثبت شد.')
      setDescription(''); setLines([{ accountTitle: '', debit: '', credit: '' }, { accountTitle: '', debit: '', credit: '' }])
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>حسابداری دوبل</span><h1>سند حسابداری</h1><p>هر سند باید بدهکار و بستانکار برابر داشته باشد؛ بدهکار: {format(d)} · بستانکار: {format(c)} {balanced ? '✓ متوازن' : '× نامتوازن'}</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card">
        <h3>سند جدید</h3>
        <form onSubmit={save}>
          <label>شرح سند<input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength="500" placeholder="مثلاً بستن صندوق روزانه" /></label>
          <div className="form-pair">
            <label>شعبه<select value={branchId} onChange={(e) => setBranchId(e.target.value)}><BranchOptions branches={branches} /></select></label>
            <label>سال مالی<select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)}><YearOptions years={fiscalYears} /></select></label>
          </div>
          {lines.map((l, i) => <div key={i} className="journal-line">
            <input value={l.accountTitle} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, accountTitle: e.target.value } : x))} placeholder="عنوان حساب (صندوق، فروش، ...)" required />
            <input type="number" min="0" value={l.debit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: '' } : x))} placeholder="بدهکار" />
            <input type="number" min="0" value={l.credit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: '' } : x))} placeholder="بستانکار" />
            {lines.length > 2 && <button type="button" className="table-action danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>×</button>}
          </div>)}
          <button type="button" className="secondary-button" onClick={() => setLines((ls) => [...ls, { accountTitle: '', debit: '', credit: '' }])}>＋ افزودن آرتیکل</button>
          <div className="form-actions"><button className="submit" disabled={!balanced}>ثبت سند متوازن</button></div>
          {!balanced && <small>برای ثبت، جمع بدهکار و بستانکار باید برابر و بزرگ‌تر از صفر باشد.</small>}
        </form>
      </section>
      <section className="card">
        <div className="card-head"><div><h3>دفتر روزنامه</h3><p>{format(journals.length)} سند</p></div></div>
        {journals.length ? <div className="journal-list">{journals.map((j) => <div key={j.id} className="journal-item"><div className="card-head"><strong>سند #{j.id} · {j.description}</strong><button className="table-action danger" onClick={async () => { if (confirm(`حذف سند #${j.id}؟`)) try { await onCall('deleteJournal', { id: j.id }); onNotice('سند حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></div><table><thead><tr><th>حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>{j.lines.map((l) => <tr key={l.id}><td>{l.accountTitle}</td><td>{format(l.debit)}</td><td>{format(l.credit)}</td></tr>)}</tbody></table></div>)}</div> : <Empty title="سندی ثبت نشده" hint="اولین سند دوبل حسابداری را ثبت کن." />}
      </section>
    </div>
  </>
}

export function OrgPage({ branches, fiscalYears, onCall, onNotice }) {
  const [branch, setBranch] = useState({ name: '', phone: '', address: '' })
  const [editingBranch, setEditingBranch] = useState(null)
  const [year, setYear] = useState({ title: '', startDate: '', endDate: '' })
  const [editingYear, setEditingYear] = useState(null)
  async function saveBranch(e) {
    e.preventDefault()
    try {
      if (editingBranch) await onCall('updateBranch', { ...branch, id: editingBranch.id, active: branch.active ?? true })
      else await onCall('addBranch', branch)
      onNotice('شعبه ذخیره شد.'); setEditingBranch(null); setBranch({ name: '', phone: '', address: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  async function saveYear(e) {
    e.preventDefault()
    try {
      if (editingYear) await onCall('updateFiscalYear', { ...year, id: editingYear.id })
      else await onCall('addFiscalYear', year)
      onNotice('سال مالی ذخیره شد.'); setEditingYear(null); setYear({ title: '', startDate: '', endDate: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>مدیریت</span><h1>شعبه‌ها و سال مالی</h1><p>چند شعبه بساز، سال مالی را باز و بسته کن؛ اسناد هر شعبه و سال جدا می‌ماند.</p></div>
    <div className="workspace-grid">
      <section className="card form-card">
        <h3>{editingBranch ? 'ویرایش شعبه' : 'شعبه جدید'}</h3>
        <form onSubmit={saveBranch}>
          <label>نام شعبه<input value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} required /></label>
          <label>تلفن<input value={branch.phone} onChange={(e) => setBranch({ ...branch, phone: e.target.value })} /></label>
          <label>نشانی<input value={branch.address} onChange={(e) => setBranch({ ...branch, address: e.target.value })} /></label>
          {editingBranch && <label className="check-label"><input type="checkbox" checked={branch.active ?? true} onChange={(e) => setBranch({ ...branch, active: e.target.checked })} /> فعال</label>}
          <div className="form-actions"><button className="submit">ذخیره شعبه</button>{editingBranch && <button type="button" className="secondary-button" onClick={() => { setEditingBranch(null); setBranch({ name: '', phone: '', address: '' }) }}>انصراف</button>}</div>
        </form>
        {branches.length ? <div className="table-scroll"><table><thead><tr><th>شعبه</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{branches.map((b) => <tr key={b.id}><td><strong>{b.name}</strong><small className="cell-sub">{b.phone || '—'} · {b.address || '—'}</small></td><td>{b.active ? 'فعال' : 'غیرفعال'}</td><td><button className="table-action" onClick={() => { setEditingBranch(b); setBranch({ name: b.name, phone: b.phone || '', address: b.address || '', active: Boolean(b.active) }) }}>ویرایش</button><button className="table-action danger" onClick={async () => { if (confirm(`حذف شعبه «${b.name}»؟`)) try { await onCall('deleteBranch', { id: b.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}</tbody></table></div> : <Empty title="شعبه‌ای ثبت نشده" hint="شعبه مرکزی را بساز." />}
      </section>
      <section className="card form-card">
        <h3>{editingYear ? 'ویرایش سال مالی' : 'سال مالی جدید'}</h3>
        <form onSubmit={saveYear}>
          <label>عنوان<input value={year.title} onChange={(e) => setYear({ ...year, title: e.target.value })} required placeholder="مثلاً 1405" /></label>
          <div className="form-pair"><label>شروع<input value={year.startDate} onChange={(e) => setYear({ ...year, startDate: e.target.value })} placeholder="1405/01/01" /></label><label>پایان<input value={year.endDate} onChange={(e) => setYear({ ...year, endDate: e.target.value })} placeholder="1405/12/29" /></label></div>
          <div className="form-actions"><button className="submit">ذخیره سال مالی</button>{editingYear && <button type="button" className="secondary-button" onClick={() => { setEditingYear(null); setYear({ title: '', startDate: '', endDate: '' }) }}>انصراف</button>}</div>
        </form>
        {fiscalYears.length ? <div className="table-scroll"><table><thead><tr><th>سال</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{fiscalYears.map((y) => <tr key={y.id}><td><strong>{y.title}</strong><small className="cell-sub">{y.startDate || '—'} تا {y.endDate || '—'}</small></td><td>{y.isClosed ? 'بسته 🔒' : 'باز 🔓'}</td><td><button className="table-action" onClick={async () => { try { await onCall('setFiscalYearClosed', { id: y.id, closed: !y.isClosed }); onNotice(y.isClosed ? 'سال مالی باز شد.' : 'سال مالی بسته شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>{y.isClosed ? 'باز کردن' : 'بستن'}</button><button className="table-action" onClick={() => { setEditingYear(y); setYear({ title: y.title, startDate: y.startDate || '', endDate: y.endDate || '' }) }}>ویرایش</button></td></tr>)}</tbody></table></div> : <Empty title="سال مالی ثبت نشده" hint="سال مالی جاری را بساز." />}
      </section>
    </div>
  </>
}

export function PayrollPage({ employees, payrolls, onCall, onNotice }) {
  const [emp, setEmp] = useState({ name: '', role: '', phone: '', baseSalary: '' })
  const [editingEmp, setEditingEmp] = useState(null)
  const [pay, setPay] = useState({ employeeId: '', month: '', amount: '', bonus: 0, deduction: 0, paid: false, description: '' })
  const [editingPay, setEditingPay] = useState(null)
  const totalUnpaid = useMemo(() => payrolls.filter((p) => !p.paid).reduce((a, p) => a + p.net, 0), [payrolls])
  async function saveEmp(e) {
    e.preventDefault()
    try {
      if (editingEmp) await onCall('updateEmployee', { ...emp, id: editingEmp.id, baseSalary: Number(emp.baseSalary || 0), active: emp.active ?? true })
      else await onCall('addEmployee', { ...emp, baseSalary: Number(emp.baseSalary || 0) })
      onNotice('کارمند ذخیره شد.'); setEditingEmp(null); setEmp({ name: '', role: '', phone: '', baseSalary: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  async function savePay(e) {
    e.preventDefault()
    try {
      const payload = { ...pay, employeeId: Number(pay.employeeId), amount: Number(pay.amount || 0), bonus: Number(pay.bonus || 0), deduction: Number(pay.deduction || 0) }
      if (editingPay) await onCall('updatePayroll', { ...payload, id: editingPay.id })
      else await onCall('addPayroll', payload)
      onNotice('حقوق ثبت شد.'); setEditingPay(null); setPay({ employeeId: '', month: '', amount: '', bonus: 0, deduction: 0, paid: false, description: '' })
    } catch (err) { onNotice(`خطا: ${err.message}`) }
  }
  return <>
    <div className="page-title"><span>منابع انسانی</span><h1>حقوق و دستمزد</h1><p>پرونده پرسنل، حقوق ماهانه با مزایا و کسورات؛ جمع پرداخت‌نشده: {format(totalUnpaid)} تومان</p></div>
    <div className="workspace-grid">
      <section className="card form-card">
        <h3>{editingEmp ? 'ویرایش کارمند' : 'کارمند جدید'}</h3>
        <form onSubmit={saveEmp}>
          <label>نام<input value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })} required /></label>
          <div className="form-pair"><label>سمت<input value={emp.role} onChange={(e) => setEmp({ ...emp, role: e.target.value })} placeholder="فروشنده، نانوا..." /></label><label>تلفن<input value={emp.phone} onChange={(e) => setEmp({ ...emp, phone: e.target.value })} /></label></div>
          <label>حقوق پایه<input type="number" min="0" value={emp.baseSalary} onChange={(e) => setEmp({ ...emp, baseSalary: e.target.value })} /></label>
          {editingEmp && <label className="check-label"><input type="checkbox" checked={emp.active ?? true} onChange={(e) => setEmp({ ...emp, active: e.target.checked })} /> فعال</label>}
          <div className="form-actions"><button className="submit">ذخیره کارمند</button>{editingEmp && <button type="button" className="secondary-button" onClick={() => { setEditingEmp(null); setEmp({ name: '', role: '', phone: '', baseSalary: '' }) }}>انصراف</button>}</div>
        </form>
        {employees.length ? <div className="table-scroll"><table><thead><tr><th>کارمند</th><th>حقوق پایه</th><th>عملیات</th></tr></thead><tbody>{employees.map((x) => <tr key={x.id}><td><strong>{x.name}</strong><small className="cell-sub">{x.role || '—'} · {x.active ? 'فعال' : 'غیرفعال'}</small></td><td>{format(x.baseSalary)}</td><td><button className="table-action" onClick={() => { setEditingEmp(x); setEmp({ name: x.name, role: x.role || '', phone: x.phone || '', baseSalary: x.baseSalary, active: Boolean(x.active) }); setPay((p) => ({ ...p, employeeId: x.id, amount: x.baseSalary })) }}>ویرایش</button><button className="table-action danger" onClick={async () => { if (confirm(`حذف «${x.name}»؟`)) try { await onCall('deleteEmployee', { id: x.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}</tbody></table></div> : <Empty title="کارمندی ثبت نشده" hint="اولین پرسنل فروشگاه را ثبت کن." />}
      </section>
      <section className="card form-card">
        <h3>{editingPay ? 'ویرایش حقوق' : 'ثبت حقوق ماهانه'}</h3>
        <form onSubmit={savePay}>
          <div className="form-pair">
            <label>کارمند<select value={pay.employeeId} onChange={(e) => { const id = e.target.value; const x = employees.find((v) => v.id === Number(id)); setPay({ ...pay, employeeId: id, amount: x ? x.baseSalary : '' }) }} required><option value="">— انتخاب —</option>{employees.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>ماه<input value={pay.month} onChange={(e) => setPay({ ...pay, month: e.target.value })} required placeholder="مهر 1405" /></label>
          </div>
          <div className="form-pair"><label>حقوق<input type="number" min="0" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required /></label><label>مزایا<input type="number" min="0" value={pay.bonus} onChange={(e) => setPay({ ...pay, bonus: e.target.value })} /></label></div>
          <div className="form-pair"><label>کسورات<input type="number" min="0" value={pay.deduction} onChange={(e) => setPay({ ...pay, deduction: e.target.value })} /></label><label className="check-label"><input type="checkbox" checked={pay.paid} onChange={(e) => setPay({ ...pay, paid: e.target.checked })} /> پرداخت شد</label></div>
          <label>شرح<input value={pay.description} onChange={(e) => setPay({ ...pay, description: e.target.value })} /></label>
          <div className="total"><span>خالص پرداختی</span><strong>{format(Number(pay.amount || 0) + Number(pay.bonus || 0) - Number(pay.deduction || 0))} تومان</strong></div>
          <div className="form-actions"><button className="submit">ثبت حقوق</button>{editingPay && <button type="button" className="secondary-button" onClick={() => { setEditingPay(null); setPay({ employeeId: '', month: '', amount: '', bonus: 0, deduction: 0, paid: false, description: '' }) }}>انصراف</button>}</div>
        </form>
        {payrolls.length ? <div className="table-scroll"><table><thead><tr><th>حقوق</th><th>خالص</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{payrolls.map((p) => <tr key={p.id}><td><strong>{p.employeeName} · {p.month}</strong><small className="cell-sub">حقوق {format(p.amount)} + مزایا {format(p.bonus)} − کسور {format(p.deduction)}</small></td><td>{format(p.net)}</td><td>{p.paid ? 'پرداخت‌شده ✓' : 'پرداخت‌نشده'}</td><td><button className="table-action" onClick={async () => { try { await onCall('updatePayroll', { id: p.id, month: p.month, amount: p.amount, bonus: p.bonus, deduction: p.deduction, paid: !p.paid, payrollDate: p.payrollDate, description: p.description || '' }); onNotice('وضعیت پرداخت تغییر کرد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>تغییر وضعیت</button><button className="table-action danger" onClick={async () => { if (confirm('حذف این حقوق؟')) try { await onCall('deletePayroll', { id: p.id }); onNotice('حذف شد.') } catch (err) { onNotice(`خطا: ${err.message}`) } }}>حذف</button></td></tr>)}</tbody></table></div> : <Empty title="حقوقی ثبت نشده" hint="حقوق ماه جاری پرسنل را ثبت کن." />}
      </section>
    </div>
  </>
}
