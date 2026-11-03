"use client";

import { useActionState } from "react";
import Link from "next/link";
import { applyImport, previewImport, type PreviewState } from "./actions";

const BADGE: Record<string, string> = {
  add: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  error: "bg-red-100 text-red-800",
};

export function ImportForm() {
  const [preview, upload, uploading] = useActionState<PreviewState, FormData>(previewImport, {});
  const [result, confirm, saving] = useActionState<PreviewState, FormData>(applyImport, {});

  if (result.done) {
    return (
      <div className="card space-y-3">
        <p className="text-green-800">{result.done}</p>
        {result.error && <p className="text-sm text-red-700">{result.error}</p>}
        <Link className="btn" href="/students">Go to students</Link>
      </div>
    );
  }

  const counts = { add: 0, update: 0, error: 0 };
  preview.plan?.forEach((p) => counts[p.action]++);

  return (
    <div className="space-y-6">
      <form action={upload} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="file">Excel or CSV file</label>
          <input id="file" name="file" type="file" accept=".xlsx,.csv" required className="text-sm" />
        </div>
        <button className="btn" type="submit" disabled={uploading}>{uploading ? "Reading…" : "Check file"}</button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download */}
        <a className="text-sm text-blue-700 underline" href="/students/export?template=1">Download the template</a>
        {preview.error && <p className="w-full text-sm text-red-700">{preview.error}</p>}
        {result.error && <p className="w-full text-sm text-red-700">{result.error}</p>}
      </form>

      {preview.plan && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{counts.add}</strong> new, <strong>{counts.update}</strong> to update
            {counts.error > 0 && <>, <strong className="text-red-700">{counts.error}</strong> with problems (will be skipped)</>}.
            Existing students are matched by phone number, then email.
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-gray-600">
                <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">What happens</th></tr>
              </thead>
              <tbody>
                {preview.plan.map((p) => (
                  <tr key={p.line} className="border-b last:border-0">
                    <td className="px-3 py-2 text-gray-500">{p.line}</td>
                    <td className="px-3 py-2" dir="auto">{p.name}</td>
                    <td className="px-3 py-2">{p.data?.phone}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${BADGE[p.action]}`}>{p.message}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {counts.add + counts.update > 0 && (
            <form action={confirm}>
              <input type="hidden" name="payload" value={preview.payload} />
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Importing…" : `Import ${counts.add + counts.update} students`}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
