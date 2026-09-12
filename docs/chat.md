# Chat pentru programări

Starea finală pentru release este documentată în [verificarea din 13 septembrie 2026](release-check-2026-09-13.md): audit curat, 174 de teste trecute și test de email confirmat de utilizator. Rezultatele datate de mai jos rămân istoricul implementării.

## Comportament

- `/cont/mesaje` afișează programările acceptate (`confirmedAt != null`), cu o conversație pentru fiecare programare. Există acces din header, meniul contului, dashboard și cardul/detaliile programării.
- Adresa unei conversații este `/cont/mesaje/{chatSlug}`, de exemplu `/cont/mesaje/a1b2c3d4e5f6`. `Appointment.chatSlug` este un identificator aleatoriu propriu conversației, format din exact 12 caractere hexazecimale mici, generat o singură dată în PostgreSQL. Are constrângeri de format și unicitate; la coliziune, crearea programării reîncearcă tranzacția. Identificatorul rămâne stabil la modificarea numelor sau a stării programării.
- Slugul programării (`routeSlug`) rămâne separat, pentru `/cont/programari/{routeSlug}`. Linkurile vechi de chat sunt rezolvate numai după verificarea participantului și redirecționează către noua adresă. API-ul acceptă temporar și identificatorul vechi, iar URL-urile emailurilor aflate deja în reîncercare rămân neschimbate pentru a păstra idempotency.
- Numai pacientul și studentul programării, autentificați și cu email verificat, pot accesa conversația. API-ul nu expune emailurile, datele de naștere ori ID-urile profilurilor.
- La încheiere sau anulare, conversația trece imediat la „Conversații trecute”. Se poate scrie încă exact 7 zile de la `statusChangedAt`; apoi istoricul rămâne doar pentru citire. Mesajele noi nu prelungesc termenul.
- Mesajele sunt text simplu, maximum 2.000 de caractere. Clientul actualizează conversația, lista și numărul de conversații necitite la 3 secunde, numai când pagina este vizibilă. Reia imediat verificarea la revenirea în pagină, focalizare și reconectare; cererile blocate sunt anulate după 10 secunde. Headerul și cardul din cont folosesc aceeași sursă de actualizare a numărului de conversații necitite.
- În conversație, mesajele noi apar fără reîncărcarea paginii și fără pierderea ciornei. Dacă utilizatorul citește mai sus în istoric, poziția se păstrează și apare un buton pentru mesajele noi.
- Inboxul și conversația ocupă spațiul rămas din `100dvh`, între headerul și footerul aflate în fluxul normal. Lista conversațiilor și istoricul au scroll separat; formularul rămâne vizibil. Pe telefon, lista și conversația se afișează pe pagini separate. Ferestrele joase folosesc controale compacte. Regula se aplică exclusiv paginilor marcate `.chat-page`; celelalte pagini își păstrează scrollul obișnuit. `interactiveWidget: "resizes-content"` cere redimensionarea la deschiderea tastaturii în browserele care acceptă opțiunea.
- Marcarea ca citit folosește exclusiv ID-urile mesajelor primite care sunt vizibile în conversația focalizată; deschiderea listei nu le marchează ca citite.

## Moderare

`src/lib/chat/moderation.ts` aplică `omni-moderation-latest`, apoi un verdict contextual structurat prin Responses API, implicit cu `gpt-4.1-mini`. Promptul permite descrieri stomatologice și reclamații respectuoase și blochează atacurile personale, amenințările, hărțuirea, discriminarea, șantajul și spamul. Clasificarea automată poate produce erori; nu constituie o garanție că orice abuz va fi detectat.

Doar textul mesajului curent ajunge la OpenAI. Răspunsurile folosesc `store: false`; aceasta nu elimină automat jurnalele de monitorizare ale furnizorului. Pagina „Despre verificare” explică procesarea.

Mesajele blocate nu sunt salvate în istoric și nu generează emailuri. În caz de timeout, refuz, răspuns invalid, lipsă de credit sau indisponibilitate API, trimiterea se oprește și textul rămâne în formular. Limita de 20 de încercări/minut și 200/oră/utilizator se aplică înainte de apelurile externe. Aceste limite sunt stocate în PostgreSQL, nu în memoria unei instanțe.

O cheie validă nu implică existența creditelor. `credit_balance_exhausted` / `insufficient_quota` necesită verificarea soldului în OpenAI Platform → Billing. Nu activa ocolirea moderării ca soluție.

## Emailuri și pornire

Configurație server, exclusiv în `.env` sau în secret store:

```dotenv
OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=gpt-4.1-mini
CHAT_WORKER_SECRET=
CHAT_WORKER_URL=http://localhost:3000
```

`CHAT_WORKER_SECRET` trebuie să fie un secret aleatoriu de minimum 32 de caractere. Aplicația și workerul folosesc aceeași valoare. `CHAT_WORKER_URL` este originea internă accesibilă workerului; `BETTER_AUTH_URL` este originea publică folosită pentru autentificare și linkurile din email. Sunt necesare și `RESEND_API_KEY` / `EMAIL_FROM`, deja folosite de aplicație. `.env.example` trebuie să rămână fără secrete.

După verificarea faptului că `DATABASE_URL` indică instanța intenționată:

```bash
npx prisma generate
npm run db:deploy
npm run dev
```

În dezvoltare, `npm run dev` pornește atât Next.js, cât și procesul notificărilor. Oprirea serverului oprește și procesul de email. `npm run dev:web` pornește numai aplicația, pentru verificări care nu trebuie să trimită emailuri.

Pentru a porni numai procesul de email, cu aplicația deja pornită:

```bash
npm run chat:emails
```

Acest proces poate trimite emailuri reale pentru mesajele necitite. Nu îl porni împotriva unei baze cu pacienți reali ca simplu test. În producție, `compose.production.yaml` definește serviciul `chat-email-worker`; aplică migrarea într-un singur pas de release înainte de pornirea noii aplicații. Workerul rulează separat și la restart își reia lucrul din PostgreSQL.

Primul email devine eligibil când cel mai vechi mesaj rămas necitit are minimum 3 minute. Workerul verifică la 15 secunde și grupează mesajele, cu un interval minim de 15 minute per destinatar și conversație. Nu include textul mesajelor, numele pacientului sau detalii clinice. Dacă mesajele sunt citite înainte de expediere, lotul este omis. Dacă mesajele mai vechi au fost citite, dar unul nou a rămas necitit, se așteaptă împlinirea celor 3 minute pentru acesta; simpla vechime a lotului nu declanșează expedierea.

Procesarea folosește loturi persistente, blocări pe destinatar/conversație, lease de 60 de secunde, token de lease și cheie Resend de idempotency stabilă. Destinatarul, expeditorul și URL-ul sunt înghețate la prima încercare. Reîncercările sunt limitate la 8 încercări și maximum 23 de ore, în interiorul ferestrei Resend de 24 de ore. Loturile `FAILED` necesită investigare; nu se reexpediază automat cu o cheie nouă dacă rezultatul primei livrări este incert.

Monitorizează vechimea loturilor `PENDING` / `SENDING`, numărul de `FAILED`, disponibilitatea workerului și creditele API. Nu loga textul conversațiilor, secrete sau răspunsuri brute ale furnizorilor. Istoricul nu este șters automat; procedurile de retenție/export/ștergere trebuie corelate cu regulile aplicației înainte de lansare pentru utilizatori reali.

Workerul include acum `node scripts/chat-email-worker.mjs --healthcheck`, care citește statusul local fără apeluri către furnizori. Codul de ieșire este 0 când procesarea este sănătoasă și 1 când există erori, status mai vechi de 120 de secunde, loturi definitiv eșuate sau loturi eligibile întârziate cu peste 5 minute fără lease activ. Docker Compose rulează verificarea automat. Fișierul implicit este `/tmp/universident-chat-email-worker-health.json` în Linux și poate fi configurat cu `CHAT_WORKER_HEALTH_FILE` pentru procese locale multiple. Nu conține mesaje, destinatari sau secrete. În caz de eroare, workerul reîncearcă; `unhealthy` nu declanșează singur restart sau notificări externe.

Update-ul include migrările `20260911100000_add_moderated_appointment_chat` și `20260912100000_add_chat_conversation_slug`. A doua atribuie automat identificatori unici și programărilor existente, fără să modifice mesajele. Aplică ambele migrări înainte de pornirea noii imagini de aplicație și a workerului.

## Verificare locală

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
npx prisma migrate status
node --conditions=react-server --import tsx scripts/test-chat-integration.ts
```

Testul de integrare verifică mai întâi o conexiune locală, creează o bază separată cu nume aleatoriu, aplică toate migrările și o șterge la final. Necesită dreptul de creare a unei baze locale. Nu modifică datele din baza configurată și nu apelează OpenAI sau Resend. Acoperă autorizarea, izolarea datelor, moderarea simulată, idempotency, confirmările de citire, notificările, reîncercările concurente, închiderea după 7 zile și paginarea.

Pentru QA manual, opțiunea `CHAT_KEEP_TEST_DB=1` păstrează numai baza creată de test și scrie configurarea și parola aleatorie a conturilor fictive în `.env.chat-test` (ignorat de Git). Nu porni această configurație ca producție. După test, oprește serverul temporar, verifică numele exact al bazei generate și elimină doar acea bază și `.env.chat-test`.

Pentru release mai sunt necesare auditul dependențelor și o verificare reală a livrării emailurilor către o adresă de test autorizată. Testele cu transport simulat nu confirmă configurația DNS sau livrarea Resend.

## Rezultatul verificărilor din 11 septembrie 2026

- `npm run check`: reușit (TypeScript, ESLint, 162 de teste, build Next.js 16.3.4).
- Testele de integrare PostgreSQL și verificările HTTP: reușite. Au fost verificate inclusiv originile nepermise, accesul unui alt pacient, limitele corpului cererii și autentificarea workerului.
- Schema Prisma validă; toate cele 25 de migrări sunt aplicate în baza locală, inclusiv migrarea chatului.
- Verificare vizuală pe desktop și la 390 × 844 px: autentificare cu revenire în conversație, inbox, mesaje și păstrarea textului după eroarea de moderare.
- Verificarea reală OpenAI este blocată de `credit_balance_exhausted` / HTTP 429. Nu a fost confirmată încă clasificarea exemplelor cu serviciul real.
- Nu au fost trimise emailuri reale. Workerul nu a fost pornit împotriva bazei locale cu utilizatori existenți.
- Next.js a fost actualizat la 16.3.4, eliminând alertele critice găsite. `npm audit --omit=dev` mai raportează 4 alerte high în `prisma`, `@prisma/config`, `deepmerge-ts` și `mysql2`. Propunerea automată de remediere implică downgrade major Prisma; nu a fost aplicată. Auditul rămâne un pas neîncheiat pentru release.
- Baza temporară și configurarea conturilor fictive au fost eliminate după QA.

## Actualizări și verificări din 12 septembrie 2026

- Actualizarea periodică este comună pentru mesaje, inbox și notificări. Cinci teste noi acoperă actualizarea repetată, revenirea în pagină, evenimentele concurente, cererile blocate și anularea la ascundere/demontare.
- `npm run check`: reușit (TypeScript, ESLint, 167 de teste și build). Buildul a fost repetat cu succes după ultimele ajustări CSS.
- Testele de integrare au fost repetate cu o bază PostgreSQL fictivă separată. În browser, un mesaj primit a apărut fără refresh; citirea istoricului nu a schimbat poziția de scroll sau ciorna. Indicatorul de mesaje noi a dus la finalul conversației. Headerul și cardul din cont s-au actualizat automat.
- Layoutul a fost verificat la 1280 × 720, 390 × 844, 320 × 568, 324 × 769, 568 × 320, 844 × 390 și 390 × 420 px. Headerul, footerul și formularul încap în viewport; istoricul și lista conversațiilor au scroll intern. Coloanele `minmax(0, 1fr)` elimină lățimea minimă implicită care tăia chatul sub aproximativ 418 px.
- Pe `/cont`, scrollul documentului rămâne normal. Footerul chatului are poziționare statică. Testul de 390 × 420 simulează un viewport redus; nu reprezintă o verificare a tastaturii virtuale pe un telefon fizic.
- QA folosește moderare și transport email simulate; nu au fost trimise emailuri reale și nu au fost folosite mesaje ale utilizatorilor existenți.

## Activarea emailurilor și ajustarea headerului din 12 septembrie 2026

- Sub 420 px, tema se alege din meniul principal; selectorul separat și săgeata contului sunt ascunse. Mesajele, contul și meniul folosesc butoane de 44 px, cu 48 px între centre și margine dreaptă de 16 px la lățimea de 320 px. „Echipa” apare direct în header de la 1150 px; meniul principal se ascunde la același prag. Pragurile și schimbarea temei au fost verificate în browser.
- Cauza locală a lipsei notificărilor a fost procesul de email oprit. `npm run dev` pornește acum aplicația împreună cu procesul, iar `npm run dev:web` rămâne disponibil pentru pornire fără trimitere de emailuri. Serverul local și procesul au fost pornite, iar ruta internă a răspuns HTTP 200.
- Întârzierea minimă este de 3 minute pentru cel mai vechi mesaj încă necitit, reverificată înainte de trimitere. Testul de integrare verifică inclusiv momentul de 3 minute minus 1 ms, momentul exact de eligibilitate și cazul în care un mesaj anterior a fost deja citit. Verificările pentru mesaje citite, grupare, cooldown și reîncercări concurente au trecut.
- `npm run check` și testele de integrare în PostgreSQL au trecut. Nu au fost modificate mesaje ale utilizatorilor pentru testarea regulii.
- Transportul real `deliverChatEmail` a fost verificat cu adresa oficială de test `delivered+universident-chat@resend.dev`: Resend a acceptat notificarea folosind configurația locală. Acesta verifică acceptarea de către furnizor; livrarea într-un inbox personal necesită o adresă autorizată pentru test. Documentație furnizor: https://resend.com/docs/dashboard/emails/send-test-emails.

## Sluguri și verificarea finală din 12 septembrie 2026

- Conversațiile folosesc acum identificatori proprii de 12 caractere hexazecimale. Migrarea a fost verificată pe o bază fictivă cu programări și mesaje existente, apoi aplicată bazei locale: 26 de migrări aplicate, fără modificarea istoricului mesajelor.
- `npm run check` a trecut cu 169 de teste, TypeScript, ESLint și buildul de producție. Schema Prisma este validă. Integrarea PostgreSQL confirmă formatul și unicitatea slugurilor, reîncercarea coliziunilor, stabilitatea după închiderea programării, autorizarea, linkurile și paginarea.
- Imaginile Docker `runner` și `migrator` se construiesc. În containerul de producție cu date fictive au trecut verificările de sănătate, autentificare, resurse statice și headere de securitate. Migrațiile sunt la zi și din imaginea `migrator`.
- În browser, accesarea linkului vechi după autentificare a redirecționat către `/cont/mesaje/3a016846a04f`. Navigarea chat → programare → chat a păstrat identificatorii separați și istoricul, fără erori în consolă.
- Verificarea reală OpenAI a trecut acum cu două texte sintetice: confirmare permisă și insultă directă blocată. Blocajul de credit consemnat pe 11 septembrie nu s-a mai reprodus. Nu au fost folosite mesaje ale pacienților pentru acest test.
- `npm audit --omit=dev` rămâne nereușit: 4 pachete marcate high și 0 critical. Pachetele semnalate (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`) nu apar în buildul standalone al aplicației, dar sunt prezente în lanțul de instrumente/migrări. Remedierea automată propune un downgrade major Prisma; nu a fost aplicată. Raportul detaliat este în `docs/release-check-2026-09-12.md`.
- Containerul și baza fictivă de verificare au fost eliminate. Aplicația locală și procesul de email rămân active; ruta internă a workerului răspunde HTTP 200. Configurația serverului public și livrarea într-un inbox personal nu au fost validate prin aceste verificări locale.
