export function Input({ type = "text", ...props }) {
  return (
    <input
      type={type}
      className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      {...props}
    />
  );
}
