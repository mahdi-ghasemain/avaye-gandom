import { useMemo, useState } from 'react'

const blank = { name: '', category: '', sku: '', barcode: '', unit: 'عدد', price: '', purchasePrice: '', stock: '', minStock: '', active: true }
const format = (value) => new Intl.NumberFormat('fa-IR').format(value)

export default function ProductsPage({ products, desktop, onChange, onNotice, onCall }) {
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [adjustingId, setAdjustingId] = useState(null)
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const filtered = useMemo(() => products.filter((item) => [item.name, item.category, item.sku, item.barcode].some((value) => String(value || '').toLocaleLowerCase('fa-IR').includes(query.trim().toLocaleLowerCase('fa-IR')))), [products, query])

  function field(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  function clear() { setEditingId(null); setForm(blank) }
  function edit(item) { setEditingId(item.id); setForm({ ...item, price: String(item.price), purchasePrice: String(item.purchasePrice), minStock: String(item.minStock), stock: String(item.stock), active: Boolean(item.active) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function save(event) {
    event.preventDefault()
    const input = { ...form, price: Number(form.price), purchasePrice: Number(form.purchasePrice || 0), minStock: Number(form.minStock || 0), stock: Number(form.stock || 0) }
    try {
      if (onCall) {
        if (editingId) await onCall('updateProduct', { ...input, id: editingId })
        else await onCall('addProduct', input)
      } else if (desktop) {
        const state = editingId ? await window.avayeAPI.updateProduct({ ...input, id: editingId }) : await window.avayeAPI.addProduct(input)
        onChange(state)
      } else if (editingId) onChange({ products: products.map((item) => item.id === editingId ? { ...item, ...input } : item) })
      else onChange({ products: [{ ...input, id: Date.now() }, ...products] })
      onNotice(editingId ? 'محصول ویرایش شد.' : 'محصول جدید ثبت شد.')
      clear()
    } catch (error) { onNotice(`خطا: ${error.message}`) }
  }

  async function remove(item) {
    if (!confirm(`حذف «${item.name}»؟ اگر در اسناد استفاده شده باشد، فقط غیرفعال می‌شود.`)) return
    try {
      if (onCall) await onCall('deleteProduct', { id: item.id })
      else if (desktop) onChange(await window.avayeAPI.deleteProduct({ id: item.id }))
      else onChange({ products: products.filter((x) => x.id !== item.id) })
      onNotice('محصول حذف / غیرفعال شد.')
    } catch (error) { onNotice(`خطا: ${error.message}`) }
  }

  async function adjust(event) {
    event.preventDefault()
    const delta = Number(change)
    if (!Number.isSafeInteger(delta) || delta === 0 || !reason.trim()) return
    try {
      if (onCall) await onCall('adjustStock', { productId: adjustingId, change: delta, reason })
      else if (desktop) onChange(await window.avayeAPI.adjustStock({ productId: adjustingId, change: delta, reason }))
      else onChange({ products: products.map((item) => item.id === adjustingId ? { ...item, stock: item.stock + delta } : item) })
      setAdjustingId(null); setChange(''); setReason(''); onNotice('موجودی اصلاح شد.')
    } catch (error) { onNotice(`خطا: ${error.message}`) }
  }

  return <>
    <div className="page-title"><span>مدیریت فروشگاه</span><h1>محصولات</h1><p>فهرست را خودت بساز و هر زمان خواستی قیمت، مشخصات و موجودی را تغییر بده.</p></div>
    <div className="workspace-grid product-workspace">
      <section className="card form-card"><h3>{editingId ? 'ویرایش محصول' : 'افزودن محصول'}</h3><p>اطلاعات محصول را وارد کن.</p><form onSubmit={save}>
        <label>نام محصول<input value={form.name} onChange={(e) => field('name', e.target.value)} placeholder="مثلاً نان باگت" maxLength="120" required /></label>
        <label>گروه محصول<input value={form.category || ''} onChange={(e) => field('category', e.target.value)} placeholder="مثلاً نان، شیرینی" maxLength="120" /></label>
        <div className="form-pair"><label>کد محصول<input value={form.sku || ''} onChange={(e) => field('sku', e.target.value)} maxLength="60" /></label><label>بارکد<input value={form.barcode || ''} onChange={(e) => field('barcode', e.target.value)} maxLength="60" /></label></div>
        <div className="form-pair"><label>واحد سنجش<input value={form.unit || ''} onChange={(e) => field('unit', e.target.value)} placeholder="عدد" maxLength="30" /></label><label>حداقل موجودی<input type="number" min="0" step="1" value={form.minStock ?? ''} onChange={(e) => field('minStock', e.target.value)} /></label></div>
        <div className="form-pair"><label>قیمت فروش (تومان)<input type="number" min="1" step="1" value={form.price} onChange={(e) => field('price', e.target.value)} required /></label><label>قیمت خرید (تومان)<input type="number" min="0" step="1" value={form.purchasePrice ?? ''} onChange={(e) => field('purchasePrice', e.target.value)} /></label></div>
        {!editingId && <label>موجودی اولیه<input type="number" min="0" step="1" value={form.stock} onChange={(e) => field('stock', e.target.value)} required /></label>}
        {editingId && <label className="check-label"><input type="checkbox" checked={form.active} onChange={(e) => field('active', e.target.checked)} /> محصول فعال و قابل فروش باشد</label>}
        <div className="form-actions"><button className="submit">{editingId ? 'ذخیرهٔ تغییرات' : '＋ افزودن محصول'}</button>{editingId && <button type="button" className="secondary-button" onClick={clear}>انصراف</button>}</div>
      </form></section>
      <section className="card"><div className="card-head"><div><h3>فهرست محصولات</h3><p>{format(products.length)} محصول ثبت‌شده</p></div><span className="badge">{format(filtered.length)} نتیجه</span></div><input className="product-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو بر اساس نام، گروه، کد یا بارکد" aria-label="جست‌وجوی محصولات" />
        {filtered.length ? <div className="table-scroll"><table><thead><tr><th>محصول</th><th>کد / بارکد</th><th>قیمت فروش</th><th>موجودی</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small className="cell-sub">{item.category} · {item.unit}</small></td><td>{item.sku || item.barcode || '—'}</td><td>{format(item.price)} تومان</td><td><span className={item.stock <= item.minStock ? 'low-stock' : 'stock'}>{format(item.stock)} {item.unit}</span></td><td>{item.active ? 'فعال' : 'غیرفعال'}</td><td><button className="table-action" onClick={() => edit(item)}>ویرایش</button><button className="table-action" onClick={() => { setAdjustingId(item.id); setChange(''); setReason('') }}>اصلاح موجودی</button><button className="table-action danger" onClick={() => remove(item)}>حذف</button></td></tr>)}</tbody></table></div> : <div className="empty"><span>◈</span><strong>{products.length ? 'محصولی با این جست‌وجو پیدا نشد' : 'هنوز محصولی وارد نشده'}</strong><p>{products.length ? 'عبارت دیگری را امتحان کن.' : 'از فرم روبه‌رو اولین محصول را وارد کن.'}</p></div>}
      </section>
    </div>
    {adjustingId && <div className="modal-backdrop" role="presentation"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="adjust-title"><h3 id="adjust-title">اصلاح موجودی</h3><p>برای افزایش عدد مثبت و برای کاهش عدد منفی وارد کن. دلیل این تغییر ثبت می‌شود.</p><form onSubmit={adjust}><label>تغییر موجودی<input type="number" step="1" value={change} onChange={(e) => setChange(e.target.value)} required /></label><label>دلیل تغییر<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً انبارگردانی" required /></label><div className="form-actions"><button className="submit">ثبت تغییر</button><button type="button" className="secondary-button" onClick={() => setAdjustingId(null)}>انصراف</button></div></form></div></div>}
  </>
}
