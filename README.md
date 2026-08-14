# Universident

Universident este o aplicație web în limba română care conectează pacienți adulți cu studenți la medicină dentară. Studentul își publică profilul profesional și disponibilitatea reală, cu locație, tratamente și supervizor; pacientul caută după tratament și oraș și trimite o cerere pentru un interval disponibil.

## Funcționalități disponibile

- conturi separate pentru pacient și student, cu verificare email și resetare parolă;
- profil profesional public pentru student și profil protejat pentru pacient;
- cataloage pentru tratamente, orașe și universități dentare din România;
- calendar responsive pentru disponibilitatea studentului;
- disponibilități unice sau recurente, limitate prin număr de apariții ori dată finală;
- editarea sau anularea unei singure apariții și a seriei recurente;
- căutare după tratament și oraș, fără rezultate duplicate pentru același student;
- alegerea inteligentă a intervalelor de programare în funcție de durata tratamentului;
- cereri, confirmări, respingeri, anulări, finalizare și marcarea neprezentării;
- notificări consumabile pentru schimbările programărilor;
- reputație bazată pe ultimele 10 programări relevante;
- recenzii bilaterale asociate programărilor finalizate.

## Tehnologii

- Next.js App Router, React și TypeScript;
- PostgreSQL și Prisma;
- Better Auth pentru autentificare;
- Tailwind CSS, shadcn/Radix și FullCalendar;
- Resend pentru verificarea emailului și resetarea parolei.

## Cerințe locale

- Node.js 20.9 sau mai nou; Node 24 este recomandat și definit în `.nvmrc`;
- npm;
- Docker, pentru baza PostgreSQL locală, sau o instanță PostgreSQL compatibilă.

## Pornire locală

1. Instalează dependențele:

```bash
npm ci
```

2. Copiază configurația exemplu și înlocuiește valorile marcate:

```bash
cp .env.example .env
```

3. Pornește PostgreSQL local:

```bash
docker compose up -d db
```

4. Aplică migrațiile și încarcă datele de catalog:

```bash
npm run db:deploy
npm run db:seed
```

5. Pornește aplicația:

```bash
npm run dev
```

Aplicația va fi disponibilă la [http://localhost:3000](http://localhost:3000), iar starea conexiunii cu baza poate fi verificată la [http://localhost:3000/api/health](http://localhost:3000/api/health).

### Date demo locale

După ce există exact un pacient și un student în baza locală, poți încărca scenariile UI cu:

```bash
npm run demo:seed
```

Scriptul înlocuiește calendarul și programările dummy ale celor două conturi. Refuză explicit rularea în `NODE_ENV=production` și pe baze de date care nu folosesc un host local. Nu folosi acest script pentru date reale.

## Variabile de mediu

| Variabilă | Obligatorie | Utilizare |
| --- | --- | --- |
| `DATABASE_URL` | da | conexiunea PostgreSQL; în hosting serverless folosește URL-ul pooled recomandat de furnizor |
| `BETTER_AUTH_URL` | da | originea canonică exactă a aplicației, de exemplu `https://universident.ro`, fără cale suplimentară |
| `BETTER_AUTH_SECRET` | da | secret aleator puternic, diferit între medii |
| `RESEND_API_KEY` | da în producție | trimiterea mesajelor de verificare și resetare |
| `EMAIL_FROM` | da în producție | expeditor de pe un domeniu verificat în Resend |
| `POSTGRES_PASSWORD` | doar pentru Compose | parola containerului PostgreSQL local |

Generează un secret de autentificare cu un generator criptografic, de exemplu `openssl rand -base64 32`. Nu comite niciodată fișierul `.env`.

## Verificări

Pentru verificarea completă înainte de commit sau deployment:

```bash
npm run check
npm audit --omit=dev
npm run db:validate
npx prisma migrate status
```

Comenzile individuale sunt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment

Aplicația poate rula pe Vercel sau pe orice serviciu Node.js care acceptă Next.js și are acces la PostgreSQL.

Ordinea recomandată pentru un release este:

1. configurează toate variabilele de mediu în platforma de hosting;
2. creează o bază PostgreSQL cu conexiuni TLS, pooling, backup și point-in-time recovery;
3. rulează `npm run db:deploy` o singură dată pentru release;
4. la prima instalare rulează `npm run db:seed` pentru cataloage;
5. construiește cu `npm run build` și pornește cu `npm run start`;
6. configurează monitorizarea pe `GET /api/health` și verifică livrarea reală a emailurilor;
7. verifică domeniul HTTPS și setează `BETTER_AUTH_URL` la aceeași origine exactă.

Nu rula `prisma db push`, `prisma migrate dev`, resetarea bazei sau `npm run demo:seed` într-un release de producție. Migrațiile trebuie aplicate înainte ca versiunea nouă a aplicației să primească trafic.

### Vercel

- conectează repository-ul și baza PostgreSQL externă;
- folosește `npm run build` drept build command;
- rulează migrațiile într-un pas de release/CI separat, nu simultan în mai multe build-uri Vercel;
- folosește pentru `DATABASE_URL` endpointul pooled al furnizorului;
- configurează domeniul final înainte de testarea linkurilor Better Auth și Resend.

## Checklist înainte de trafic real

Din punct de vedere tehnic, proiectul poate fi publicat într-un mediu de staging după ce variabilele și serviciile externe sunt configurate. Pentru pacienți reali mai sunt responsabilități operaționale care nu pot fi rezolvate doar în cod:

- politici de confidențialitate, termeni de utilizare și temeiul legal pentru prelucrarea datelor;
- perioade de retenție, procedură de ștergere/export și contracte cu furnizorii de date;
- backup verificat printr-un test de restaurare;
- monitorizare, alerte, rotația secretelor și un proces de răspuns la incidente;
- verificarea domeniului de email și testarea cap-coadă a verificării și resetării parolei;
- testare de acceptanță pe mobil și desktop cu conturi separate de pacient și student;
- revizuire juridică și de securitate înainte de stocarea datelor unor pacienți reali.

## Structura principală

```text
prisma/                 schema, migrații și seed-ul cataloagelor
scripts/                fixture demo exclusiv local
src/app/                pagini și rute API Next.js
src/components/         componente UI și fluxuri interactive
src/lib/appointments/   regulile programărilor, notificărilor și recenziilor
src/lib/availability/   recurență, materializare și sloturi de rezervare
src/lib/public-students/ căutare și profiluri publice
```

Regulile detaliate de produs și convențiile pentru contribuții sunt în [`AGENTS.md`](./AGENTS.md).
