# Cum funcționează CI/CD pentru Universident

## Explicația scurtă

„La fiecare pull request și push pe main, GitHub pornește un mediu Linux temporar. Instalează versiunile din lockfile, verifică tipurile și codul, rulează testele, construiește aplicația și imaginile Docker și verifică vulnerabilitățile dependențelor de producție. Un eșec blochează deploymentul. După activarea CD, numai un commit verificat de pe main poate fi instalat pe VPS prin SSH. Deploymentul folosește Docker Compose existent, este serializat și se încheie cu verificări de sănătate. Migrațiile de producție rămân manuale.”

CI înseamnă **Continuous Integration**: verificarea automată a schimbărilor înainte să fie acceptate. CD poate însemna **Continuous Delivery** (versiunea este pregătită pentru publicare) sau **Continuous Deployment** (publicarea se face automat). Acest workflow permite deployment manual și, după setarea `VPS_DEPLOY_ENABLED=true`, deployment automat.

## Ce face fiecare parte și de ce

| Parte | Ce face | De ce există |
| --- | --- | --- |
| Declanșare | Rulează la PR, push pe `main` și manual. | Problemele sunt detectate înainte de release; `main` este verificat și după merge. |
| Checkout și Node | Descarcă acel commit și folosește Node 24 din `.nvmrc`. | Verificăm codul exact al schimbării cu aceeași versiune majoră Node ca în Docker. |
| `npm ci` și cache | Instalează exact versiunile din `package-lock.json`; reutilizează descărcările npm. | Instalarea este repetabilă și mai rapidă. Cache-ul nu înlocuiește instalarea și verificările. |
| Prisma și route types | Generează clientul Prisma și tipurile rutelor Next.js; validează schema. | Un runner nou nu are fișierele generate pe calculatorul dezvoltatorului. |
| Typecheck | Verifică folosirea tipurilor TypeScript. | Prinde, de exemplu, un câmp greșit sau un argument incompatibil înainte de runtime. |
| Lint | Rulează regulile ESLint existente. | Identifică greșeli și încălcări ale convențiilor proiectului. |
| Teste | Rulează testele existente pentru programări, disponibilitate, DST, confidențialitate, notificări și siguranța fixture-urilor. | Verifică reguli concrete de produs, nu doar dacă fișierele se compilează. |
| PostgreSQL temporar | Aplică migrările într-o bază nouă și verifică integrarea chatului într-o bază separată creată de test. | Testăm SQL, autorizare și tranzacții reale fără date de pacienți sau acces la baza de producție. |
| Build și SEO | Construiește Next.js pentru producție și verifică 38 de răspunsuri HTTP cu fixture-uri locale. | Verifică artefactul standalone, paginile, metadatele și indexarea. |
| Docker | Construiește targeturile existente `runner` și `migrator`. | Un build npm reușit nu garantează singur că imaginea de producție poate fi construită. |
| Audit | Rulează `npm audit --omit=dev`. | O vulnerabilitate cunoscută în arborele dependențelor de producție oprește release-ul. |
| Condiția de CD | Cere CI reușit, ramura `main` și activare explicită pentru push. | Un PR sau o ramură de lucru nu poate publica în producție. |
| SSH | Folosește o cheie din GitHub Secrets și verifică cheia hostului din `known_hosts`. | Autentifică accesul și identitatea serverului; nu acceptă automat orice server care răspunde. |
| Serializare | GitHub permite un singur deployment activ; `flock` ține un lock și pe VPS. | Două versiuni nu trebuie să actualizeze serviciile simultan, inclusiv după o conexiune întreruptă. |
| Commitul instalat | Fetch pe main, verificarea SHA-ului testat și actualizare numai fast-forward. | Refuză o versiune depășită, istoricul divergent și checkout-urile cu modificări locale. |
| Docker Compose pe VPS | Construiește și actualizează aplicația și workerul în instalația existentă. | Automatizează procesul manual actual și păstrează baza, volumul și `.env`. |
| Migrații | Verifică numai `prisma migrate status` în producție. | O modificare de schemă poate afecta datele; migrațiile neaplicate opresc deploymentul pentru analiză. |
| Health checks | Așteaptă sănătatea containerelor și HTTP 200 la `/api/health` prin HTTPS. | „Comanda a terminat” nu înseamnă automat „aplicația funcționează”. |
| Dependabot | Propune actualizări npm săptămânal și Actions lunar. | Remedierile viitoare devin PR-uri verificabile; nu sunt instalate sau publicate automat. |

CI folosește numai date și secrete fictive. Secretele VPS sunt disponibile exclusiv jobului de deployment din environment-ul `production`, restricționat la `main`. Variabilele aplicației și datele reale rămân pe VPS. Tokenul workflow-ului are doar `contents: read`.

Acesta este un deployment pe un singur VPS, cu reconstrucție Docker acolo. Nu promite zero downtime și nu transferă exact imaginea construită în CI; verifică același cod și lockfile, apoi reconstruiește prin infrastructura existentă. Health checks nu înlocuiesc testarea autentificării sau a livrării emailurilor.

## Ce vulnerabilități au fost remediate

Auditul inițial raporta **3 pachete vulnerabile în dependențele de producție** și **18 în total**, cu un pachet clasificat critical. Numărul include și pachetele care depind indirect de o bibliotecă vulnerabilă; nu reprezintă tot atâtea vulnerabilități independente în paginile publice.

| Pachet | Problemă raportată | Remediere |
| --- | --- | --- |
| `next` | Probleme de cache, divulgare de informații și SSRF în optimizarea imaginilor, în configurațiile afectate. SSRF înseamnă că serverul poate fi determinat să facă cereri către destinații nepermise. | `16.3.6 → 16.3.8`; `eslint-config-next` a fost aliniat la `16.3.8`. |
| `sharp` | Vulnerabilitate de memorie în librsvg, folosit pentru SVG; în anumite condiții poate permite executare de cod pe Linux. | `0.35.4 → 0.35.5`, inclusiv binarele native/libvips asociate. |
| `source-map-js` | Un source map construit malițios poate bloca procesarea și consuma CPU. | `1.2.1 → 1.2.2`. |
| `proxy-addr` | Clasificarea incorectă a adreselor IPv4/IPv6 putea permite falsificarea IP-ului considerat de încredere. Era constatarea critical din uneltele de dezvoltare. | `2.0.7 → 2.0.8`. |
| MCP SDK și `undici` | Probleme raportate de autorizare, divulgare de date, redirecturi HTTP, TLS și blocare a procesului în uneltele care le folosesc. | MCP SDK `1.30.0 → 1.32.1`; `undici` `7.29.0 → 7.30.1`. |
| Alte dependențe tranzitive | Probleme de parsare, consum excesiv de resurse și clasificare a adreselor. | `brace-expansion` `1.1.18 → 1.1.21` și `5.0.9 → 5.0.12`; `hono` `4.13.7 → 4.13.13`; `ip-address` `10.5.0 → 10.7.4`; `postcss-selector-parser` `7.1.5 → 7.1.7`. |

Au fost folosite actualizări compatibile, fără `npm audit fix --force`, fără downgrade Next.js și fără schimbarea versiunii majore Prisma. Modificările tranzitive sunt fixate în `package-lock.json`, iar `npm ci` le reproduce pe runner și la buildul Docker.

Acestea sunt probleme cunoscute ale versiunilor instalate, nu dovada că Universident a fost compromis. De exemplu, advisory-ul Next.js pentru SSRF precizează că aplicațiile fără `images.remotePatterns` nu sunt afectate de acel caz; configurația acestui proiect nu definește asemenea reguli. Actualizarea elimină totuși versiunea vulnerabilă și include celelalte remedieri. Surse: [Next.js SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

## Ce a rămas și ce înseamnă

După actualizări, `npm audit --omit=dev` raportează **0 vulnerabilități**. Auditul complet raportează **8 high**, toate pornind din aceeași problemă în `braces@3.0.3`: tipare de acolade foarte adânc imbricate pot epuiza stiva procesului. Advisory-ul nu are o versiune reparată publicată la 21 octombrie 2026. [Advisory braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Lanțul este în uneltele ESLint/shadcn, nu în arborele npm de producție. Biblioteca nu a fost găsită în serverul standalone verificat local. Etapele de build și imaginea migrator includ totuși dependențe de dezvoltare; de aceea problema rămâne documentată și trebuie urmărită. Nu există o demonstrație de exploatare prin rutele publice ale aplicației. Sugestia `npm audit fix --force` de a coborî shadcn/Next tooling la versiuni vechi nu a fost aplicată: ar schimba incompatibil infrastructura fără a reprezenta un patch al bibliotecii actuale.

## De ce poate bloca auditul chiar și o problemă minoră

O vulnerabilitate nu împiedică neapărat buildul sau pornirea aplicației. **Noi alegem politica de acceptare a release-ului.** Comanda folosită, `npm audit --omit=dev`, întoarce implicit un cod de eroare dacă găsește orice vulnerabilitate în dependențele incluse. GitHub marchează jobul CI ca eșuat, iar `needs: ci` împiedică pornirea deploymentului. [Documentația npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

Un prag precum `--audit-level=high` ar permite trecerea constatărilor low/moderate, păstrându-le în raport. Acesta ar fi o schimbare explicită de politică, nu o remediere. Nu a fost făcută aici: ghidul proiectului cere audit de producție ca verificare de release, iar problemele inițiale din producție erau high și aveau patch-uri disponibile.

Severitatea, locul unde rulează pachetul, accesul atacatorului și existența unui patch trebuie evaluate împreună. Pentru o problemă fără patch, o eventuală excepție trebuie să aibă justificare, domeniu limitat și reevaluare; nu se rezolvă prin ignorarea tuturor erorilor auditului.

## Ce trebuie să poți demonstra

- Un PR cu **CI verde**, inclusiv buildurile Docker, dovedește verificarea automată în GitHub, nu doar pe calculatorul local.
- O rulare `verify` reușită dovedește accesul și condițiile curente ale VPS-ului; nu dovedește instalarea unei versiuni noi.
- O rulare `deploy` reușită și verificarea aplicației după aceasta dovedesc un deployment efectiv.
- Cât timp VPS-ul nu a fost configurat și verificat, descrierea corectă este „CI implementat și verificat; CD pregătit, în așteptarea configurării VPS”.

Pașii operaționali, secretele și procedura de activare sunt în [deployment.md](deployment.md).
