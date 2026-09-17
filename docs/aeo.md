# Conținut public pentru motoare de răspuns

AEO în această implementare înseamnă informații publice clare, disponibile în HTML, și date structurate care descriu aceleași informații. Nu există o activare care să garanteze citarea site-ului de către motoarele AI. Google indică aceleași fundamente de accesibilitate pentru crawlere, indexare și conținut util ca pentru SEO: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).

## Implementare

- Pagina principală are cinci întrebări cu răspunsuri vizibile: ce este platforma, cine realizează tratamentele, cum se solicită o programare, limita de vârstă și necesitatea confirmării studentului. Textul descrie fluxurile existente, fără recomandări clinice sau promisiuni suplimentare despre prețuri ori rezultate medicale.
- Paginile cu rezultate reale explică tratamentul, orașul și diferența dintre cerere și confirmare. Profilurile spun explicit că persoana este student la medicină dentară și afișează anul și universitatea.
- Pagina principală publică JSON-LD `WebSite` și `WebPage`, cu identitate și descriere comune textului vizibil.
- Directorul publică `CollectionPage`. Combinațiile valide cu rezultate adaugă `ItemList`, care descrie exclusiv studenții afișați pe pagina curentă. Pagina a doua păstrează propriul URL și pozițiile corecte în listă. Listele personalizate pentru utilizatori autentificați nu sunt exportate în JSON-LD.
- Profilurile eligibile publică `ProfilePage` cu entitatea `Person`. Nu sunt declarate tipuri `Dentist` sau `MedicalClinic`, diplome, acreditări, angajatori, prețuri ori statistici neverificate.

Textele comune sunt în `src/lib/seo/public-answers.ts`. Generatorii JSON-LD sunt în `src/lib/seo/structured-data.ts`, iar componenta server în `src/components/seo/structured-data.tsx`.

## Vizibilitate și date personale

Datele structurate sunt emise doar în mediul public definit de configurația SEO existentă. Profilurile demo, retrase, neverificate sau inexistente, căutările invalide și fără rezultate, autentificarea și paginile private nu primesc aceste date structurate. Staging-ul nu primește JSON-LD și rămâne `noindex`. Regulile de autentificare și autorizare nu sunt modificate.

Schema profilului folosește o selecție explicită: numele public, URL-ul public, universitatea și anul de studiu. Nu copiază DTO-ul complet și nu include emailuri, identificatori de cont, recenzii ale pacienților, date de naștere, note sau programări. Serializarea escapează caracterele care ar putea închide tagul `<script>`, inclusiv când un nume conține text HTML.

Pagina `/echipa`, metadatele ei și layout-ul rădăcină rămân nemodificate. Nu sunt necesare migrații, seed, noi câmpuri în baza de date sau servicii externe.

## Întrebări frecvente și crawlere

Întrebările și răspunsurile sunt conținut vizibil, nu markup ascuns destinat exclusiv roboților. Nu este adăugat `FAQPage` pentru a promite un rezultat special Google: Google a retras rezultatele îmbogățite FAQ în mai 2026 și documentația aferentă în iunie. [Anunțurile oficiale](https://developers.google.com/search/updates#june-2026).

Nu sunt necesare fișiere `llms.txt` sau reguli speciale care să ocolească restricțiile paginilor private. Crawlerele care respectă robots.txt folosesc regulile deja implementate pentru paginile publice. Google precizează că `llms.txt` nu influențează vizibilitatea sau clasarea în Google Search. [Ghidul pentru experiențele generative](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Verificare și publicare

`npm run check` verifică tipurile, lint-ul, testele și build-ul. Testele AEO acoperă corespondența dintre descriere și răspunsul vizibil, izolarea datelor personale, serializarea sigură și paginarea listelor. `npm run test:seo`, după build, verifică și JSON-LD din HTML-ul livrat efectiv, folosind exclusiv baza fictivă în memorie; verifică absența sa pe paginile neeligibile și în staging.

Verificări locale la 17 septembrie 2026: `npm run check` trecut, cu 186 de teste și build de producție reușit; `npm run test:seo` trecut, cu 38 de cereri HTTP și verificări ale conținutului JSON-LD. Pagina `/echipa`, layout-ul rădăcină, schema bazei de date și antetele de securitate existente sunt nemodificate.

Un build pregătește fișierele. Pentru a fi folosite pe site, build-ul trebuie publicat prin procedura normală, cu `DEPLOYMENT_ENV=production`, `BETTER_AUTH_URL=https://universident.ro` și antetul public `Host` păstrat de reverse proxy. Comenzile de verificare nu publică build-ul și nu repornesc servicii. Configurația reală a mediului rămâne exclusă din Git.

După publicare, urmează [pașii SEO pentru Search Console](seo.md#după-publicare), verifică HTML-ul și JSON-LD pe câteva pagini publice și urmărește indexarea și traficul. Indexarea, afișarea rezultatelor îmbogățite și citarea în răspunsuri AI sunt decizii ale motoarelor respective, nu rezultate garantate de markup.
