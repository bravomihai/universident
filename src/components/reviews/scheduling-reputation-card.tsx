import { CancellationReputationLabel } from "@/components/reviews/cancellation-reputation-label";
import { Card, CardContent } from "@/components/ui/card";

export function SchedulingReputationCard({
  count,
  description,
  value,
}: {
  count: number;
  description: string;
  value: string;
}) {
  return (
    <Card size="sm" className="py-3">
      <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4">
        <div className="min-w-0">
          <p className="font-medium">Reputație de programare</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <CancellationReputationLabel count={count} value={value} />
      </CardContent>
    </Card>
  );
}
