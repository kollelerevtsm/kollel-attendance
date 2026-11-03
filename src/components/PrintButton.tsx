"use client";

export function PrintButton() {
  return (
    <button className="btn-secondary" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}
