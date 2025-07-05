export function Card({ children }) {
  return <div className="rounded-xl border p-4 shadow-sm bg-[#101822]">{children}</div>;
}

export function CardContent({ children, className = "" }) {
  return <div className={`mt-2 ${className}`}>{children}</div>;
}
