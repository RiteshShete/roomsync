/** Form-level failure shown above the submit button. Announced to assistive tech; never clears the form. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-ink">
      {message}
    </p>
  );
}
