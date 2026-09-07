import { getCancellationReputationTone } from "@/lib/appointments/cancellation-reputation-tone";
import { cn } from "@/lib/utils";

const toneStyles = {
  green:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  yellow:
    "border-yellow-600/30 bg-yellow-500/10 text-yellow-800 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-300",
  orange:
    "border-orange-600/30 bg-orange-500/10 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300",
  red:
    "border-red-600/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300",
};

export function CancellationReputationLabel({
  count,
  value,
}: {
  count: number;
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 rounded-full border px-3 py-1 text-sm font-medium",
        toneStyles[getCancellationReputationTone(count)],
      )}
    >
      {value}
    </span>
  );
}
