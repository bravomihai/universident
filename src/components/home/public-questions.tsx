import { CalendarPlus, Clock3, GraduationCap, HeartHandshake, UserRoundCheck, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { publicAnswers } from "@/lib/seo/public-answers";

const questionIcons: Record<(typeof publicAnswers)[number]["id"], LucideIcon> = {
  "ce-este-universident": HeartHandshake,
  "cine-realizeaza-tratamentele": GraduationCap,
  "cum-solicit-programare": CalendarPlus,
  "cine-se-poate-programa": UserRoundCheck,
  "confirmarea-programarii": Clock3,
};

export function PublicQuestions() {
  return (
    <section id="intrebari-frecvente" className="home-section" aria-labelledby="public-questions-title">
      <div className="home-section-heading">
        <h2 id="public-questions-title">Întrebări despre Universident</h2>
      </div>
      <Card>
        <CardContent>
          <dl className="divide-y">
            {publicAnswers.map((entry) => {
              const Icon = questionIcons[entry.id];
              return (
                <div key={entry.id} id={entry.id} className="space-y-2 py-5 first:pt-0 last:pb-0">
                  <dt className="flex items-start gap-3 text-lg font-semibold">
                    <Icon className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.7} aria-hidden="true" />
                    <span className="min-w-0">{entry.question}</span>
                  </dt>
                  <dd className="max-w-3xl pl-8 text-muted-foreground leading-relaxed">{entry.answer}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
