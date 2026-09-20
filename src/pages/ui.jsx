export const format = (value) => new Intl.NumberFormat('fa-IR').format(Number(value) || 0)

export const INVOICE_LABEL = { sale: 'فروش', purchase: 'خرید', sale_return: 'برگشت از فروش', purchase_return: 'برگشت از خرید' }
export const VOUCHER_LABEL = { input: 'رسید انبار', output: 'حواله خروج', transfer: 'انتقال بین شعبه' }
export const CASH_LABEL = { receipt: 'دریافت', payment: 'پرداخت' }
export const METHOD_LABEL = { cash: 'نقد', card: 'کارتخوان', bank_transfer: 'حواله بانکی', cheque: 'چک' }
export const CHEQUE_LABEL = { pending: 'نزد صندوق', collected: 'وصول‌شده', bounced: 'برگشتی', spent: 'خرج‌شده', returned: 'عودت داده‌شده' }
export const PERSON_LABEL = { customer: 'مشتری', supplier: 'تأمین‌کننده', both: 'هر دو', other: 'سایر' }

export function Empty({ icon = '▤', title, hint }) {
  return <div className="empty"><span>{icon}</span><strong>{title}</strong><p>{hint}</p></div>
}

export function Modal({ title, hint, onClose, children }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  </div>
}

export function PersonOptions({ persons, allowEmpty = true }) {
  return <>
    {allowEmpty && <option value="">— بدون طرف‌حساب —</option>}
    {persons.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
  </>
}

export function BranchOptions({ branches, allowEmpty = true }) {
  return <>
    {allowEmpty && <option value="">— بدون شعبه —</option>}
    {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
  </>
}

export function YearOptions({ years, allowEmpty = true }) {
  return <>
    {allowEmpty && <option value="">— بدون سال مالی —</option>}
    {years.map((y) => <option key={y.id} value={y.id}>{y.title}{y.isClosed ? ' (بسته)' : ''}</option>)}
  </>
}
