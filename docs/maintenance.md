# Suspendarea temporară a accesului public

Pagina din `ops/maintenance/index.html` este statică și independentă de Next.js. Include stilurile, cele două variante ale logo-ului și fontul Figtree folosit în aplicație, fără JavaScript, resurse externe, analytics sau solicitări către API. Subseturile Figtree latin și latin-ext sunt încorporate, împreună cu licența SIL Open Font License în sursa HTML, astfel încât și diacriticele românești folosesc fontul corect. Linkul „Verifică din nou >” solicită din nou pagina principală. Tema urmează preferința sistemului.

Fragmentul `ops/nginx/maintenance-server.conf` returnează HTTP **503**, `Retry-After: 3600` și `Cache-Control: no-store, max-age=0` când există fișierul `/var/www/universident-maintenance/enabled`. Păstrează antetele globale de securitate ale aplicației și adaugă o politică CSP limitată la pagina statică. CSS inline și fonturile încorporate sunt permise exclusiv pentru acest răspuns; scripturile și conexiunile externe sunt blocate.

Verificarea comutatorului este la nivel de `server`, înainte de alegerea rutelor. Acoperă inclusiv autentificarea, profilurile, programările, conversațiile, API-ul, `/api/health` și resursele Next.js, indiferent de metoda HTTP. Pagina internă nu poate fi accesată direct din exterior. În lipsa comutatorului, rutele existente rămân active.

## Pregătirea instalării pe VPS

Aceste fișiere nu activează automat mentenanța. Verifică mai întâi configurația reală cu `sudo nginx -T`, numai într-un terminal de încredere: rezultatul poate conține configurație privată. Identifică toate blocurile HTTPS care servesc aplicația și include-urile lor. Păstrează certificatele, regulile pentru reînnoirea lor, redirecționările HTTP și antetele existente. Dacă există deja un handler `error_page 503` sau o locație cu același nume, integrează explicit configurațiile înainte de a continua.

Folosește checkout-ul de producție și proiectul Compose existente, cu aceleași opțiuni de mediu și același nume de proiect. Dacă VPS-ul încă folosește vechiul nume `compose.production.yaml`, adaptează numele în comenzile de mai jos; nu crea un al doilea proiect Compose.

Setează variabila **de repository** GitHub `VPS_DEPLOY_ENABLED=false` și confirmă că nu există un deploy în curs. Această variabilă nu oprește un deploy deja început și nici comenzile manuale de deploy. Dacă există CDN/proxy cu cache în fața Nginx, dezactivează cache-ul pentru perioada suspendării și invalidează răspunsurile vechi, apoi verifică domeniul public.

## Instalarea inițială

Din directorul proiectului de pe VPS, instalează pagina și fragmentul de configurare:

```bash
sudo install -d -m 0755 /var/www/universident-maintenance
sudo install -m 0644 ops/maintenance/index.html /var/www/universident-maintenance/index.html
sudo install -m 0644 ops/nginx/maintenance-server.conf /etc/nginx/snippets/universident-maintenance.conf
```

În fiecare bloc HTTPS care servește aplicația, adaugă următoarea linie **înaintea oricărui `return` sau `rewrite` de la nivelul serverului**, în afara blocurilor `location`. Nu înlocui întregul virtual host și nu elimina regulile de securitate existente:

```nginx
include /etc/nginx/snippets/universident-maintenance.conf;
```

Validează configurația înainte de reîncărcare:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Fără fișierul `enabled`, aplicația rămâne accesibilă. Verifică mai întâi că site-ul și `/api/health` funcționează normal. Pe sisteme unde Nginx nu este administrat prin systemd, folosește procedura existentă de reîncărcare a serviciului.

## Activarea suspendării

Creează comutatorul numai după instalarea și verificarea configurației:

```bash
sudo touch /var/www/universident-maintenance/enabled
```

Comutarea este imediată, fără reload. Verifică domeniul public înainte de oprirea aplicației:

```bash
curl -sS -D - -o /dev/null https://universident.ro/
curl -sS -D - -o /dev/null https://universident.ro/studenti
curl -sS -D - -o /dev/null https://universident.ro/api/health
```

Toate trebuie să returneze `503`, `Retry-After: 3600` și `Cache-Control: no-store, max-age=0`. Verifică pagina și din browser, inclusiv de pe telefon. Valoarea `3600` sugerează reîncercarea peste o oră; nu reprezintă o dată promisă pentru relansare.

După confirmarea răspunsurilor, din directorul proiectului Compose existent oprește mai întâi workerul de email, apoi aplicația:

```bash
docker compose -f compose-production.yaml stop chat-email-worker
docker compose -f compose-production.yaml stop app
docker compose -f compose-production.yaml ps -a
```

Nginx rămâne pornit și afișează pagina chiar dacă aplicația este oprită. Serviciul `db` și volumul PostgreSQL rămân în loc. Nu folosi `down -v`, resetări sau ștergeri de volume pentru suspendare. Programările existente nu sunt anulate de această operațiune; mesajele email deja trimise nu pot fi retrase.

Dacă aplicația rămâne pornită pentru verificări locale pe VPS, comutatorul continuă să blocheze accesul public. Workerul trebuie oprit separat pentru a suspenda procesarea emailurilor.

## Reluarea accesului

Pentru repornirea **aceleiași versiuni**, pornește aplicația și așteaptă starea sănătoasă, apoi pornește workerul:

```bash
docker compose -f compose-production.yaml start --wait --wait-timeout 180 app
docker compose -f compose-production.yaml start --wait --wait-timeout 180 chat-email-worker
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

Dacă se instalează o versiune nouă, urmează mai întâi [regulile de deploy și migrare](deployment.md#manual-migrations-failure-recovery-and-rollback), cu migrarea revizuită aplicată o singură dată și cu același lock de deploy. Aceste comenzi `start` nu construiesc și nu instalează o versiune nouă. Pipeline-ul standard cere servicii sănătoase și HTTP 200 la verificarea publică; în timpul mentenanței răspunsul public 503 este intenționat, deci verificarea finală din Actions nu poate trece până la redeschidere. Nu dezactiva aceste verificări pentru a forța deploy-ul.

După verificarea aplicației și acceptarea relansării, elimină numai comutatorul:

```bash
sudo rm -- /var/www/universident-maintenance/enabled
```

Verifică din nou `/api/health` prin HTTPS și fluxurile publice și private. Reia cache-ul/CDN-ul, dacă a fost suspendat. Reactivează `VPS_DEPLOY_ENABLED=true` numai când dorești să permiți din nou deploy-uri automate. Pentru o nouă suspendare, recreează același fișier `enabled`.

## Verificare locală izolată

```bash
npm run test:maintenance
```

Implicit, testul folosește un container temporar `nginx:1.28-alpine`, exclusiv într-un context Docker local. Dacă ai un binar Nginx local, poți evita Docker:

```bash
MAINTENANCE_NGINX_BINARY=/usr/sbin/nginx npm run test:maintenance
```

Testul nu citește `.env`, nu pornește aplicația și nu accesează baza de date. Verifică integrarea cu fragmentele Nginx existente, rutele cu prioritate mai mare, metodele GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS, antetele și comutarea fără reload. Pentru previzualizare vizuală, deschide `ops/maintenance/index.html` direct în browser sau servește exclusiv acel director local. Un server static de previzualizare nu reproduce răspunsurile HTTP 503; acestea sunt verificate separat prin Nginx.
