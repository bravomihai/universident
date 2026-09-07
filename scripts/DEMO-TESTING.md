# Date locale pentru testare manuală

Scriptul poate adăuga **140 de studenți fictivi** pentru testarea homepage-ului,
căutării, profilurilor și calendarelor. În modul complet folosește și exact un
pacient și un student existenți, cu email verificat, pentru scenariile de programări.
Conturile din afara setului fictiv sunt păstrate: nu le schimbă parolele, sesiunile, numele sau pozele.
Rulează numai pe PostgreSQL local și refuză `NODE_ENV=production`.

## Doar profilurile pentru căutare

Acest mod **nu resetează scenariile perechii de conturi existente** și nu necesită
selectori de email sau conturi preexistente:

```bash
npm run demo:seed -- --directory-only --dry-run
npm run demo:seed -- --directory-only
```

Sunt create/reutilizate aceleași 140 de identități, cu nume marcate `(Demo)`, emailuri
`student.001@demo.universident.test` până la `student.140@demo.universident.test` și
profiluri `/studenti/student-demo-001` până la `/studenti/student-demo-140`.
Primele 100 își păstrează distribuția existentă. Profilurile 101–140 sunt încă
**40 de studenți noi pentru Afecțiuni gingivale / Cluj-Napoca**, fiecare cu
două locații în Cluj și șase intervale viitoare pentru acest tratament (60 min).
Împreună cu cele 4 rezultate din setul inițial, această căutare are 44 de profiluri
demo, înainte de eventuale rezervări sau retrageri din publicare.
Nu au parole/conturi de autentificare, nu sunt trimise emailuri și nu sunt adăugate
fotografii sau recenzii fictive. Pentru autentificare și confirmarea programărilor
folosește studentul tău existent, nu aceste identități de catalog.

- **11 orașe**: 60 de studenți cu oraș principal Cluj-Napoca și 20 în București,
  câte 12 în Iași și Timișoara, 6 în Târgu Mureș și câte 5 în Constanța, Craiova,
  Oradea, Sibiu, Arad și Galați.
- **9 tratamente** din catalog, distribuite diferit; consultația este comună,
  igienizarea este frecventă, iar specialitățile au mai puține rezultate.
- **280 de locații**, două pentru fiecare student; 20 de studenți au a doua
  locație într-un alt oraș. Numele și adresele clinicilor sunt explicit fictive.
- **840 de intervale** de 3–5 ore, șase per student, la ore diferite în următoarele
  1–55 de zile. Fiecare interval oferă tratamentele studentului cu supervizor și
  durate de 30–120 de minute, astfel încât calendarul să poată genera programări reale.
- Profiluri publicate și verificate, ani de studiu 1–6, universități din catalog,
  descrieri de lungimi diferite sau absente și actualizări cu 5–995 de
  minute în urmă. Homepage-ul afișează cele 8 profiluri eligibile cele mai recente.

Comanda afișează un tabel cu numărul exact de profiluri demo pentru fiecare pereche
oraș–tratament. Încearcă **Consultație / Cluj-Napoca**, **Igienizare / București**
pentru paginare, apoi **Tratament de canal / Iași** pentru rezultate mai puține.
Numerele din tabel exclud conturile tale existente și reflectă setul proaspăt generat;
rezervările făcute ulterior reduc disponibilitatea conform regulilor aplicației.

La rerulare se actualizează aceleași profiluri/resurse și se mută intervalele relativ
la ziua curentă, fără duplicate. Dacă ai trimis o cerere pe un interval al acestor
profiluri, scriptul **se oprește fără modificări**, indiferent de starea cererii,
pentru a păstra istoricul. La fel, refuză coliziunile de identitate, seriile active,
ofertele manuale pe intervale demo și suprapunerile cu intervale manuale. Folosește
în continuare setul existent sau o copie locală separată; nu șterge automat programări.
Scrierile sunt atomice într-o tranzacție, iar `--dry-run` rămâne complet read-only.

## Verificare și populare

Modul complet adaugă și cele 140 de profiluri, pe lângă scenariile existente.
Din rădăcina proiectului:

```bash
npm run demo:seed -- --dry-run
npm run demo:seed
```

Dacă există mai multe conturi de un rol, indică explicit perechea de test:

```bash
npm run demo:seed -- --patient-email=pacient@example.test --student-email=student@example.test --dry-run
npm run demo:seed -- --patient-email=pacient@example.test --student-email=student@example.test
```

Înlocuiește adresele exemplu cu cele ale conturilor tale. Selectorul studentului
poate fi omis dacă există un singur student în afara celor 140 de identități demo.
La rerulare păstrează aceeași pereche;
scriptul refuză să transfere istoricul demo către alt pacient sau student.

`--dry-run` verifică ținta, conturile, cataloagele și conflictele fără scrieri.
Popularea completează profilurile, publică studentul și configurează tratamente,
locații și supervizori demonstrativi. Resursele care corespund cheilor din script
sunt readuse la valorile demo; folosește această comandă doar în baza de test.
Datele relative la ziua curentă se regenerează la fiecare rulare.

Sunt resetate programările, recenziile și notificările cu cheile acestui set demo.
Calendarul din afara setului demo este păstrat. Intervalele demo caută zile libere,
păstrând cazurile istorice în trecut și pe cele viitoare în viitor. Scriptul se oprește
dacă nu găsește loc, dacă între timp calendarul se schimbă sau dacă o programare creată
manual folosește un interval demo. În acest caz continuă testarea datelor existente ori folosește
o copie locală separată pentru un set nou; nu șterge automat activitatea manuală.

## Scenarii disponibile

```bash
# Toate stările, inclusiv programare restantă și recenzie de completat:
npm run demo:seed -- --scenario=full

# Flux de cerere/confirmare nouă, fără blocaje demo de recenzii restante:
npm run demo:seed -- --scenario=booking

# Verifică mesajul și butonul dezactivat în intervalul de 20 de ore:
npm run demo:seed -- --refresh=cooldown
```

Implicit se folosește `full` și `--refresh=available`. Studentul existent are o actualizare
mai veche de 20 de ore și poate apăsa „Actualizează profilul”. Cele 140 de profiluri
fictive sunt mai recente, deci acesta nu va apărea inițial între primele 8 de pe homepage.
Cu `cooldown`, actualizarea sa este datată la momentul rulării.
`--scenario`, `--refresh` și selectorii conturilor privesc numai modul complet;
`--directory-only` nu folosește aceste opțiuni.
Opțiunile pot fi combinate cu `--dry-run`.

În scenariul `full`, pacientul trebuie să trimită recenzia restantă înainte de a
putea crea o cerere nouă. Studentul trebuie să închidă programarea restantă cu
recenzie înainte de a confirma cereri noi. Acestea sunt reguli ale aplicației.
La trecerea de la `full` la `booking`, cazurile restante demo sunt arhivate ca
expirate și nu mai blochează fluxul. Datele din afara setului demo pot avea propriile blocaje.

## Parcurs recomandat

1. Fără sesiune: homepage, dark/light, navigare, footer și căutare după
   **Consultație / Cluj-Napoca** (`/studenti?tratament=consultatie&oras=cluj-napoca`).
   Verifică resetarea filtrelor, cardul, profilul public și calendarul de programare.
2. Ca student: `/cont`, ordinea cardurilor, publicare/retragere, actualizare manuală
   și cooldown. Studentul propriu nu apare în rezultatele căutării din sesiunea sa.
3. Profiluri: nume, descriere, fotografii opționale și afișarea lor în cont/public.
4. Resurse: creare, editare, arhivare/restaurare pentru tratamente, locații și supervizori.
5. Calendar: interval nou, oferte, serie recurentă cu sfârșit explicit, mutare,
   excepție, anulare și selector zi/săptămână pe mobil.
6. Programări: cerere în așteptare, confirmare, cereri suprapuse, retragere,
   anulare cu motiv, programare restantă, închidere, neprezentare și arhivă.
7. Recenzii: completare, publicare reciprocă și profilul privat al pacientului;
   verifică și notificările necitite, apoi citirea lor din cont.
8. Securitate: schimbare parolă, resetare, schimbare email, confirmări și sesiuni.
   Folosește adrese de test la care ai acces; seed-ul nu simulează emailurile.

Verifică paginile relevante pe mobil și desktop în ambele teme. Popularea demo
pregătește datele pentru acest parcurs, nu înlocuiește testarea funcțională.

```bash
npx tsx --test scripts/local-demo-options.test.ts scripts/local-demo-schedule.test.ts scripts/local-demo-directory.test.ts
npm run check
```
