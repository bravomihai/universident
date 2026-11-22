import { Button } from "@/components/ui/button";

export function PolicyConfirmationForm({ text, version, next }: {
  text: string;
  version: string;
  next: string | null;
}) {
  return (
    <form action="/api/confirmari-cont" method="post" className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
        <input type="checkbox" name="confirmedPolicy" value={version} required className="mt-1" />
        <span>{text}</span>
      </label>
      <Button type="submit" className="w-full">Confirmă și continuă</Button>
    </form>
  );
}
