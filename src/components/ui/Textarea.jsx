export function Textarea({ ...props }) {
  return (
    <textarea
      className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      {...props}
    />
  );
}
