# SEO public Universident

## Configurația mediului

Originea canonică este `https://universident.ro`, confirmată din `BETTER_AUTH_URL` în configurația de producție existentă. Este definită în `src/lib/seo/config.ts`; URL-urile SEO nu sunt construite din hostul cererii, din localhost sau din adresele de preview.

Indexarea este activată numai dacă sunt îndeplinite simultan:

- `DEPLOYMENT_ENV=production`;
- `BETTER_AUTH_URL=https://universident.ro`, exact, fără slash final;
- `VERCEL_ENV` lipsește sau este `production`.

În dezvoltare folosește `DEPLOYMENT_ENV=development`, iar în staging `DEPLOYMENT_ENV=staging`. Valoarea absentă dezactivează indexarea, inclusiv când `NODE_ENV=production`. Variabila trebuie disponibilă în procesul aplicației; rutele SEO dinamice citesc mediul la rulare. Fișierele reale de mediu rămân excluse din Git.

`compose.production.yaml` transmite explicit `DEPLOYMENT_ENV` în container, cu valoarea sigură `staging` dacă nu este configurată. La publicarea pe domeniul confirmat, setează `DEPLOYMENT_ENV=production` în fișierul de mediu al serverului și recreează serviciul aplicației. Imaginea Docker este construită cu valori de test; rutele SEO dinamice citesc configurația publică la rulare.

Proxy-ul Next adaugă `X-Robots-Tag: noindex, nofollow` în mediile nepublice și pe hosturi diferite de `universident.ro`. Reverse proxy-ul producției trebuie să păstreze antetul public `Host`. Dezvoltarea/staging-ul livrează și `Disallow: /` în robots.txt și un sitemap gol.

## Pagini și canonical

| Pagină | Indexare în mediul public | Canonical |
| --- | --- | --- |
| `/` | Da | Originea publică + `/` |
| `/studenti` | Da | `/studenti` |
| Tratament + oraș active, cu disponibilitate reală | Da | `/studenti?tratament=…&oras=…` |
| Pagină validă de rezultate, după prima | Da | Aceeași combinație, cu `&pagina=N` |
| Combinație fără capacitate rezervabilă | Nu | Adresa acelei combinații |
| Filtre incomplete, necunoscute sau repetate; paginare invalidă | Nu | Fără canonical către alte rezultate |
| Profil public eligibil | Da | `/studenti/<slug>`, fără parametrii de context |
| Profil nepublicat, neverificat sau inexistent | Nu; pagina rămâne 404 | Fără canonical |
| Profil demo | Nu | Fără canonical |
| Cont, conversații, pacienți, autentificare, calendar de rezervare | Nu | Fără canonical public moștenit |

Parametrii ignorați de interfață (de exemplu UTM) sunt eliminați din canonical. Ordinea filtrelor este stabilă, iar `pagina=1` este omis. Fiecare pagină ulterioară validă păstrează propriul canonical și un titlu cu numărul paginii. Paginile peste limita rezultatelor redirecționează temporar către ultima pagină, inclusiv către prima pagină a unei căutări fără rezultate. Filtrele invalide rămân utile pentru corectarea selecției în formular și primesc `noindex`.

Metadatele sunt în română și descriu studenți și tratamente sub supervizare, fără promisiuni de rezultat sau calificări medicale suplimentare. `metadataBase` este aplicat numai paginilor SEO vizate. Layout-ul rădăcină și pagina `/echipa`, inclusiv metadatele ei, sunt nemodificate.

## Descoperire și eligibilitate

Sitemap-ul conține pagina principală, directorul, prima pagină a combinațiilor eligibile și profilurile publicate care trec regulile existente de vizibilitate: rol STUDENT, email verificat, universitate completată, an de studiu valid și slug public. Nu conține `/echipa`, pagini private, autentificare, rezervări, date demo sau combinații fără ofertă reală. Paginile ulterioare sunt descoperite prin linkurile de paginare existente.

Identificarea fixture-urilor acoperă slugurile `student-demo-*`, ID-urile `demo-ui-*`, domeniul de email demonstrativ și asocierea cu intervale/supervizori ai scenariului demo original, care poate păstra un slug obișnuit. În mediul public, aceste profiluri sunt excluse și din rezultatele căutării și din secțiunea de profiluri recente. Datele nu sunt șterse sau modificate.

Linkurile noi de pe `/studenti` provin exclusiv din combinații cu capacitate rezervabilă reală în fereastra de 60 de zile. Se reutilizează algoritmul calendarului pentru durata tratamentului și scăderea intervalelor ocupate de programările confirmate sau cererile neexpirate. Nu se face produs cartezian între orașe și tratamente. Rezultatele păstrează accesul către rezervare și primesc și linkuri directe către profilurile publice.

Interogările SEO sunt exclusiv de citire, cu selecții restrânse. Nu materializează recurențe și nu accesează DTO-uri private. O combinație recurentă fără intervale încă materializate este omisă conservator până când fluxul existent de calendar/căutare îi materializează disponibilitatea. Nu sunt inventate date `lastmod`. XML-ul escapează explicit caracterele speciale, inclusiv `&` dintre parametri. Răspunsul nu este stocat în cache, pentru a reflecta retragerea profilurilor și schimbarea ofertei.

În producție, robots.txt permite citirea paginilor HTML cu `noindex`, astfel încât motorul să poată vedea instrucțiunea. `/api/` este exclus de la crawling. Contul, pacienții, autentificarea și rezervarea au atât metadate restrictive, cât și antet HTTP restrictiv; antetul se aplică inclusiv redirecturilor către autentificare. Verificările server de sesiune, rol și proprietar sunt păstrate. [Google explică de ce blocarea prin robots.txt nu înlocuiește noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Verificare locală, fără acces la date reale

După instalarea dependențelor și generarea clientului Prisma, rulează `npm run check` și `npm run db:validate`. Pentru build într-un checkout care conține configurație de producție, suprascrie variabilele procesului cu o conexiune inactivă și secrete de test, fără să editezi fișierul real de mediu. Nu rula seed, migrații sau operații de publicare pentru această modificare.

`npm run test:seo`, după build, pornește propriile procese standalone pe porturi loopback temporare și le închide la final. Preloaderul `scripts/fixtures/seo-prisma.mjs` înlocuiește Prisma cu date în memorie și refuză orice metodă de scriere. Testul verifică HTML-ul și metadatele generate, XML-ul, robots.txt, paginarea, excluderea profilurilor nepublicate/demo, linkurile interne, redirecturile private și diferența dintre producție și staging folosind același build. Fixture-ul este încărcat exclusiv de acest script de test, nu de aplicația obișnuită.

Rezultate locale la 17 septembrie 2026, inclusiv completările [AEO](aeo.md): `npm run check` trecut (typecheck, lint, 186 de teste, build de producție); `npm run db:validate` trecut; `npm run test:seo` trecut (38 de cereri HTTP). Verificarea nu folosește PostgreSQL și nu confirmă oferta efectivă de pe serverul public; aceasta se verifică după publicare. Nu s-au executat migrații, seed sau teste care trimit emailuri reale.

## După publicare

1. Configurează indicatorul explicit de producție și verifică antetele publice: paginile eligibile nu trebuie să primească `X-Robots-Tag: noindex`. Staging-ul trebuie să rămână blocat.
2. Verifică proprietatea domeniului `universident.ro` în Google Search Console și trimite `https://universident.ro/sitemap.xml` în raportul Sitemaps. Verifică procesarea fără erori. [Instrucțiunile Google pentru sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
3. În URL Inspection testează live pagina principală, `/studenti`, o combinație cu ofertă reală, pagina 2 dacă există și un profil eligibil. Verifică HTML-ul, canonical-ul declarat și accesul pentru Googlebot; cere indexarea unui eșantion reprezentativ. [Documentația URL Inspection](https://support.google.com/webmasters/answer/9012289).
4. Urmărește raportul de indexare: filtrele fără rezultate și paginile private trebuie excluse; combinațiile diferite și paginile ulterioare nu trebuie consolidate toate către `/studenti`. Canonical-ul ales de Google se verifică după recrawl. Trimiterea sitemap-ului nu garantează indexarea.

Build-ul și testele locale nu publică aplicația și nu repornesc serviciile. Deploy-ul este un pas separat, autorizat explicit; această modificare nu necesită schimbări în baza de date.
