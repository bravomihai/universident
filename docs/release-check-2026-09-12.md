# Verificare Universident — 12 septembrie 2026

Raport istoric. Auditul a fost remediat și testul de email a fost confirmat ulterior; vezi [verificarea finală din 13 septembrie](release-check-2026-09-13.md) pentru starea curentă.

Update-ul a trecut verificările funcționale locale și în Docker. Publicarea are încă un punct tehnic nerezolvat: auditul dependențelor raportează patru pachete cu severitate high. Nu a fost efectuată publicarea, nici commit/push.

## Conversații cu slug propriu

Adresa canonică este `/cont/mesaje/{chatSlug}`, de exemplu `/cont/mesaje/a1b2c3d4e5f6`. Identificatorul are exact 12 caractere hexazecimale mici, este generat aleatoriu în PostgreSQL, rămâne stabil și are constrângeri de unicitate și format. Crearea programării reîncearcă numai coliziunile acestui identificator.

Rămâne o conversație pentru fiecare programare acceptată. Slugul programării și slugurile profilurilor sunt separate. Linkurile vechi de chat sunt rezolvate după verificarea accesului și redirecționează către adresa nouă; emailurile deja pregătite pentru reîncercare își păstrează URL-ul, pentru idempotency. Generarea unui identificator nu acordă acces: conversația este disponibilă numai participanților verificați ai unei programări acceptate.

Migrarea pentru slug a fost testată pe date fictive existente, păstrând programările și mesajele, apoi aplicată bazei locale. Aceasta are toate cele 26 de migrări aplicate.

## Rezultate

| Verificare | Rezultat |
| --- | --- |
| `npm run check` | Reușit: TypeScript, ESLint, 169 de teste și build Next.js 16.3.4 |
| `npm run db:validate` | Schema validă |
| Integrare PostgreSQL, bază separată | Reușit: acces, izolare, sluguri, coliziuni, moderare simulată, idempotency, citire, emailuri, paginare și limita de 7 zile |
| Docker `runner` și `migrator` | Ambele imagini construite; statusul celor 26 de migrări verificat din migrator |
| Verificări HTTP în Docker | Health 200/no-store; API chat și worker fără autentificare 401; pagină privată redirecționată la login; HTML, resurse statice și headere de securitate corecte |
| Browser, build de producție | Link vechi → autentificare → slug de 12 caractere; chat → programare → chat corect; istoricul păstrat; fără erori în consolă |
| Layout și header | Verificate în browser pragurile 420/1150 px și viewporturi de la 320 px; scroll intern al conversațiilor, header/footer în fluxul normal |
| Actualizare mesaje | Mesaje și contoare actualizate fără refresh; ciornă și poziție de citire păstrate |
| Moderare OpenAI reală | Două exemple sintetice: confirmare permisă și insultă blocată |
| Transport Resend real | Notificare acceptată la adresa oficială de test a furnizorului |
| Worker local | Activ; ruta internă răspunde HTTP 200 |
| `git diff --check` | Reușit |
| `npm audit --omit=dev` | Nereușit: 4 high, 0 critical |

Emailul devine eligibil după minimum 3 minute de la cel mai vechi mesaj încă necitit. Workerul verifică la 15 secunde, deci expedierea poate avea loc puțin mai târziu. Citirea mesajelor înainte de expediere anulează notificarea. Rămâne limita de un email la 15 minute pentru aceeași conversație și același destinatar. Testele verifică inclusiv pragul de 3 minute minus 1 ms și cazul în care rămâne necitit numai un mesaj mai nou.

Testul Resend confirmă acceptarea de către furnizor, nu livrarea într-un inbox personal. A folosit destinația de test descrisă în [documentația Resend](https://resend.com/docs/dashboard/emails/send-test-emails). Nu au fost trimise mesaje ale pacienților către furnizori pentru QA.

## Auditul dependențelor

Pachetele semnalate sunt `prisma`, `@prisma/config`, `deepmerge-ts` și `mysql2`. Sunt patru pachete afectate în același lanț de dependențe, nu patru vulnerabilități independente demonstrate în paginile aplicației.

Aceste pachete nu apar în `.next/standalone/node_modules`, dar se află în instrumentele folosite la instalare/migrare. Aplicația folosește PostgreSQL. Aceste constatări limitează expunerea identificată, fără să elimine eșecul auditului impus de `AGENTS.md` ca verificare de release.

Propunerea automată npm este trecerea Prisma de la 7.9.1 la 6.19.3, o schimbare majoră. Nu a fost aplicată. Înainte de publicare trebuie rezolvată compatibilitatea unei remedieri și repetat auditul, sau documentată explicit decizia de acceptare a riscului. Referințe: [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [mysql2 autentificare](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [mysql2 decompresie](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

## Aplicarea update-ului pe server

1. Include în versiune toate fișierele noi ale chatului și cele două migrări: `20260911100000_add_moderated_appointment_chat` și `20260912100000_add_chat_conversation_slug`.
2. Verifică pe server originea HTTPS exactă în `BETTER_AUTH_URL`, conexiunea bazei și secretele pentru autentificare, OpenAI, Resend și `CHAT_WORKER_SECRET`. Nu copia secrete în `.env.example`.
3. Aplică `npm run db:deploy` într-un singur pas de release înainte de a direcționa traficul către noua aplicație.
4. Pornește serviciul persistent `chat-email-worker` definit în `compose.production.yaml`, folosind același secret ca aplicația și URL-ul intern corect.
5. Verifică sănătatea aplicației și livrarea către un inbox de test autorizat pe configurația publică.

Structura `compose.production.yaml` a fost validată local; configurația efectivă a serverului public nu a fost inspectată. Containerul, baza fictivă și fișierele sale temporare de mediu au fost eliminate după QA. Serverul local obișnuit și workerul de email au rămas pornite.
