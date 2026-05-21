export function PageHeader({ icon, title, children }) {
  return (
    <div className="page-header">
      <h1>
        {icon && <i className={`ti ${icon}`} />}
        {title}
      </h1>
      {children}
    </div>
  )
}
