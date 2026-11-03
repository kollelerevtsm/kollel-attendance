export function Notice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
  }
  if (message) {
    return <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>;
  }
  return null;
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}
