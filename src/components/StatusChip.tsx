import { STATUS_LABEL, type NightStatus } from "@/lib/rules";

const STYLE: Record<NightStatus, string> = {
  paid: "bg-green-100 text-green-800",
  test: "bg-amber-100 text-amber-800",
  short: "bg-orange-100 text-orange-800",
  absent: "bg-gray-100 text-gray-600",
  missing_in: "bg-red-100 text-red-800",
  missing_out: "bg-red-100 text-red-800",
};

export function StatusChip({ status, amount }: { status: NightStatus; amount?: number }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
      {amount !== undefined && amount > 0 && ` $${amount}`}
    </span>
  );
}

export const NEEDS_ATTENTION: NightStatus[] = ["missing_in", "missing_out"];
