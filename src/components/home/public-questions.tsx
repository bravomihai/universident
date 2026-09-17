import { Card, CardContent } from "@/components/ui/card";
import { publicAnswers } from "@/lib/seo/public-answers";

export function PublicQuestions() {
  return (
    <section id="intrebari-frecvente" className="home-section" aria-labelledby="public-questions-title">
      <div className="home-section-heading">
        <h2 id="public-questions-title">Întrebări despre Universident</h2>
      </div>
      <Card>
        <CardContent>
          <dl className="divide-y">
            {publicAnswers.map((entry) => (
              <div key={entry.id} id={entry.id} className="space-y-2 py-5 first:pt-0 last:pb-0">
                <dt className="text-lg font-semibold">{entry.question}</dt>
                <dd className="max-w-3xl text-muted-foreground leading-relaxed">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
