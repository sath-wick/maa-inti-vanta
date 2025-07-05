export function Button({ children, onClick, variant = "default" }) {
  const base = "rounded-xl px-4 py-2 text-white font-semibold";
  const variants = {
    default: "bg-blue-600 hover:bg-blue-700",
    outline: "border border-green-600 text-blue-600 bg-green-500 hover:bg-green-700"
  };

  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick}>
      {children}
    </button>
  );
}
