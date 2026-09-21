const paths = {
  home: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  sales: <><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0M9 12h6"/></>,
  invoices: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  products: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  inventory: <><path d="M3 9 12 4l9 5v11H3V9Z"/><path d="M8 20v-7h8v7M7 9h.01M12 9h.01M17 9h.01"/></>,
  persons: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11a4 4 0 0 1 6 3.5M18 21a6 6 0 0 0-3-5"/></>,
  cash: <><rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="3"/><path d="M6 10h.01M18 15h.01"/></>,
  cheques: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 10h7M6 14h4M16 14h2"/></>,
  journal: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M11 8h5M11 12h5M11 16h3"/></>,
  payroll: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 7h5M18.5 4.5v5M16 14h5M18.5 14v5"/></>,
  org: <><path d="M4 21V8l8-5 8 5v13M2 21h20"/><path d="M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/></>,
  expenses: <><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m9 18 6-6-6-6"/></>,
}

export default function Icon({ name, size = 20 }) {
  return <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.home}</svg>
}
