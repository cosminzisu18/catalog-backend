# Catalog Digital - API

Catalog scolar online cu trei roluri: director, profesor si elev. Acest repo
contine API-ul: NestJS 11 + TypeORM + MariaDB.

- Frontend (Next.js): [catalog-frontend](https://github.com/cosminzisu18/catalog-frontend) - acolo e si ghidul pas
  cu pas prin aplicatie.
- `docs/er-diagram.md` - diagrama bazei de date (Mermaid)

Cerinte: Node.js 20.9+ si MariaDB 10.2+ (testat cu Node 24 si MariaDB 11.7).

## Pornire

### 1. Baza de date

```sql
CREATE DATABASE catalog_digital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Baza trebuie sa fie goala la prima pornire: schema e creata integral de
migratii. Nu exista conturi demo: scoala si directorul se creeaza din
frontend (`/register`), iar profesorii si elevii din panoul directorului.

### 2. API

```bash
cp .env.example .env      # completeaza DB_USER / DB_PASSWORD / JWT_SECRET
npm install
npm run start:dev         # http://localhost:3001/api
```

`CORS_ORIGIN` din `.env` trebuie sa fie adresa frontend-ului
(implicit `http://localhost:3000`).

Migratiile ruleaza automat la pornire (`DB_MIGRATIONS_RUN=true`). Se pot
rula si manual:

```bash
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/database/migrations/NumeMigratie
```

### Build de productie

```bash
npm run build && npm run start:prod
```

## Roluri

**Director** - inregistreaza scoala, gestioneaza profesori, elevi, clase,
materii si orarul; leaga profesorii de materii; aproba sau respinge cererile
de scadere a purtarii si de editare a notelor; motiveaza absentele; vede
statistici si rapoartele de activitate. Nu poate modifica direct notele.

**Profesor** - pune note (si teze) doar la materiile pe care le preda, doar
elevilor din clasele la care are ore, si doar in timpul orei din orar.
Pune absente in aceleasi conditii. Pe elev + materie + zi, fie o nota, fie o
absenta. Inregistreaza ore predate si cere scaderea purtarii pentru elevii lui.

**Elev** - isi vede notele, mediile, media clasei, locul in clasa, absentele,
materiile, orarul si istoricul purtarii.

## Cum se calculeaza mediile

Regulile urmeaza ROFUIP (Regulamentul de organizare si functionare a
unitatilor de invatamant preuniversitar), art. 109:

| Ce | Cum |
|---|---|
| Media notelor la o materie (M) | media aritmetica a notelor curente, **trunchiata** la 2 zecimale (8.666 -> 8.66) |
| Media la materie, fara teza | media notelor rotunjita la intreg; la exact 50 de sutimi se rotunjeste in favoarea elevului (8.50 -> 9, 7.49 -> 7) |
| Media la materie, cu teza | `(3 x M + teza) / 4`, rotunjita la intreg la fel (M = 8.66, teza 7: 8.245 -> 8) |
| Media generala a elevului | media aritmetica a mediilor la materii si a notei la purtare, cu 2 zecimale, prin rotunjire |
| Media clasei | media mediilor generale ale elevilor care au medie, cu 2 zecimale |

O materie la care elevul are doar teza (fara note curente) nu are inca medie.

Nota despre teza: ROFUIP 2024 nu mai prevede teze; media la materie e doar
media notelor rotunjita. Formula cu teza `(3M + T) / 4` vine din versiunile
anterioare ale regulamentului si a fost pastrata aici pentru ca era ceruta.
Fara teza, calculul e exact cel actual.

Calculul se face in sute intregi (8.50 = 850), ca sa nu apara erori de
virgula mobila. Codul e in `src/common/utils/average.util.ts`.

## Integritatea datelor

Validarea se face pe doua niveluri: in API (DTO-uri cu `class-validator`) si
in baza de date (tipuri de coloane, chei unice, chei straine si `CHECK`).

| Camp | Regula |
|---|---|
| Prenume / nume | text, 2-80 caractere, doar litere, spatii, `-` si `'`; spatiile in plus sunt eliminate |
| Email | format email valid, maxim 180 caractere, unic |
| Parola | 8-72 caractere, litera mare, litera mica, cifra si caracter special |
| Data nasterii | `zz-ll-aaaa`, data reala, varsta 5-25 ani (optionala) |
| Nota | numar 1-10, cel mult 2 zecimale; `CHECK (value BETWEEN 1 AND 10)` in DB |
| Tip nota | `NORMAL` sau `THESIS`; o teza pe elev + materie + an scolar |
| Data notei | `zz-ll-aaaa`, data reala, nu in viitor (ora Romaniei) |
| Absenta | doar pentru ziua de azi; cheie unica elev + materie + zi |
| Nota sau absenta | pe elev + materie + zi exista cel mult una dintre ele, verificat in tranzactie cu randul elevului blocat |
| Purtare | numar 1-10, poate doar sa scada; `CHECK` in DB |
| Orar | zi 1-5 (luni-vineri; `CHECK 1-7` in DB), `HH:mm`, inceput < sfarsit (si `CHECK` in DB), fara suprapuneri |

API-ul nu face conversii implicite de tip: un numar trimis ca text (`"9"`)
este refuzat. Campurile in plus din body sunt refuzate
(`forbidNonWhitelisted`).

## Structura API

Fiecare modul isi tine controller-ul, service-ul, `dto/` si `entities/`:

```
src/
  auth/        login, JWT, schimbare si resetare parola
  users/       conturi (email, hash parola, rol)
  schools/  directors/  teachers/  students/  classes/  subjects/
  grades/      note si teze, cereri de editare, medii si statistici
  absences/    absente si motivarea lor
  conduct/     cereri de scadere a purtarii
  timetable/   orar + verificarea "profesorul e la ora"
  reports/     jurnal de activitate (append-only)
  database/    conexiune, data source pentru CLI, migratii
  common/      guards, decoratori, filtre, validatori, utilitare
```

## Arhitectura

**Server (MVC cu NestJS):**

- **Model** - entitatile TypeORM (`entities/`) si migratiile.
- **Controller** - doar primeste requestul, il valideaza prin DTO si cheama
  un service. Nu contine logica.
- **Service** - toata logica: reguli, autorizare pe scoala, tranzactii.
  Fiecare service are o singura responsabilitate (de exemplu
  `GradesService` pune si listeaza note, `GradeEditRequestsService` se ocupa
  de cererile de editare, `StatsService` calculeaza medii).
- Calculele pure (medii, date, paginare) sunt functii in `common/utils/`,
  fara acces la baza de date, deci usor de testat.
- Dependentele vin prin constructor (dependency injection), iar modulele nu
  au dependente circulare.

Clientul (Next.js) este in repo-ul [catalog-frontend](https://github.com/cosminzisu18/catalog-frontend).

## Endpoint-uri principale

| Metoda | Ruta | Rol |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/login/:slug` | public |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | public |
| GET | `/api/schools/by-slug/:slug` | public |
| POST | `/api/auth/refresh`, `/api/auth/logout` | cookie de sesiune |
| POST | `/api/auth/change-password` | autentificat |
| GET | `/api/auth/me` | autentificat |
| GET/PATCH | `/api/schools/me` | director |
| GET/POST, GET/PATCH `me`, PATCH `:id/activate`, PATCH `:id/active` | `/api/directors` | director |
| GET/POST, GET/PATCH/DELETE `:id`, PATCH `:id/active` | `/api/teachers`, `/api/students` | director |
| GET/POST, PATCH/DELETE `:id`, GET/POST `:id/students`, GET `:id/teachers` | `/api/classes` | director |
| GET/POST, DELETE `:id` | `/api/subjects` | director |
| GET/PUT | `/api/subjects/teacher/:teacherId` | director |
| GET | `/api/subjects/for-student/:studentId`, `/api/grades/student/:studentId` | director |
| GET | `/api/stats/classes`, `/api/stats/classes/:id`, `/api/stats/students/:id` | director |
| GET | `/api/teachers/lookup` | director |
| GET | `/api/students/lookup`, `/api/classes/lookup` | director, profesor |
| GET | `/api/subjects/lookup` | toate rolurile (filtrat dupa rol) |
| GET/POST/PATCH/DELETE | `/api/timetable` (filtru `classId`, `teacherId`) | director |
| GET | `/api/timetable/mine`, `/api/timetable/lesson-check` | profesor |
| GET | `/api/teachers/me`, `/api/subjects/mine`, `/api/grades/mine` | profesor |
| POST | `/api/teachers/me/hours` | profesor |
| POST | `/api/grades` (`type`: `NORMAL` sau `THESIS`), `/api/grades/:id/edit-requests` | profesor |
| GET | `/api/grades/edit-requests/mine`, `/api/conduct/mine` | profesor |
| POST | `/api/conduct` | profesor |
| GET | `/api/grades/edit-requests/pending`, `/api/conduct/pending` | director |
| PATCH | `/api/grades/edit-requests/:id/decide`, `/api/conduct/:id/decide` | director |
| POST | `/api/absences` (`studentId`, `subjectId`) | profesor |
| GET | `/api/absences/mine` | profesor |
| GET | `/api/absences` (`studentId`, `classId`, `motivated`), PATCH `/api/absences/:id/motivate` | director |
| GET | `/api/absences/me` | elev |
| GET | `/api/reports` (`limit`, `cursor`, `search`, `teacherId`) | director |
| GET | `/api/reports/mine` (`limit`, `cursor`, `search`) | profesor |
| GET | `/api/students/me`, `/api/grades/my-grades`, `/api/subjects/enrolled` | elev |
| GET | `/api/conduct/my-history`, `/api/timetable/my-class`, `/api/stats/me` | elev |

Listele accepta `page`, `pageSize` (max 100), `search`, `sortBy`, `sortOrder`
si raspund cu `{ items, total, page, pageSize, totalPages }`; listele de
absente au in plus `summary: { total, motivated, unmotivated }`. Rapoartele
raspund cu `{ items, nextCursor }`; `nextCursor` se trimite inapoi ca `cursor`.

## Autentificare

Sesiunea traieste doar in doua cookie-uri `httpOnly`, `SameSite=Strict`
(`Secure` in productie). JavaScript-ul din pagina nu vede niciun token, deci un
XSS nu le poate fura; in `localStorage` nu se salveaza nimic.

| Cookie | Continut | Durata | Trimis catre |
|---|---|---|---|
| `access_token` | JWT (HS256) cu `sub`, `role`, `schoolId`, `ver` | 15 min | `/api` |
| `refresh_token` | 48 bytes aleatori, opac | 12h (cookie de sesiune) sau 7 zile cu "tine-ma minte" | doar `/api/auth` |

- **Refresh cu rotire**: `POST /auth/refresh` schimba refresh tokenul pe unul
  nou si emite un access token nou. In DB se pastreaza doar hash-ul SHA-256 al
  tokenului (tabela `refresh_tokens`).
- **Detectarea furtului**: un refresh token deja folosit, prezentat din nou,
  revoca toata familia de tokenuri a acelui login. Doua taburi care fac
  refresh in aceeasi secunda nu sunt tratate ca furt (fereastra de 30s).
- **Invalidare imediata**: `users.token_version` creste la schimbarea parolei,
  la resetarea ei si la dezactivarea contului; toate tokenurile vechi devin
  invalide. La fiecare request userul e recitit din DB.
- **Logout** revoca refresh tokenul pe server, nu doar sterge cookie-urile.
- **Resetare parola**: linkul e valabil o ora si poate fi folosit o singura
  data (marcarea ca folosit e atomica). Nu exista inca server de email, asa
  ca linkul apare in raspuns si in log doar in modul dev; in productie nu
  este afisat nicaieri (vezi "Ce se mai poate implementa").
- **CSRF**: pe langa `SameSite=Strict`, orice `POST/PATCH/PUT/DELETE` venit
  din browser trebuie sa aiba `Origin` egal cu `CORS_ORIGIN`.
- Partea de client (refresh automat la 401, fara delogare la 429) e descrisa
  in README-ul din [catalog-frontend](https://github.com/cosminzisu18/catalog-frontend).
- La pornire, serverul refuza o configuratie nesigura (ex. `JWT_SECRET` sub 32
  de caractere, durate invalide).

## Securitate

- **Parole**: bcrypt (cost 12), politica de parola puternica pe client si pe
  server. Parolele temporare generate in UI folosesc `crypto.getRandomValues`.
- **Parola temporara**: pana la schimbare, API-ul refuza orice ruta in afara de
  `/auth/me` si `/auth/change-password` (verificare in `JwtAuthGuard`).
- **Director inactiv**: poate citi, dar orice scriere e refuzata cu 403 (tot in
  `JwtAuthGuard`, dupa autentificare). Exceptii: schimbarea propriei parole si
  a propriului nume.
- **Brute force**: limita globala de requesturi, plus maxim 5/minut pe login,
  inregistrare, schimbarea si resetarea parolei. Login-ul raspunde cu acelasi
  mesaj si in acelasi timp si pentru email inexistent.
- **Autorizare**: `RolesGuard` pe fiecare endpoint. `schoolId` vine din token,
  nu din request, iar fiecare resursa e verificata ca apartine scolii.
- **SQL**: doar query builder / repository TypeORM, cu parametri. `sortBy`
  trece printr-o lista de coloane permise. `%` si `_` din cautare sunt escapate.
- **Date sensibile**: hash-ul parolei nu este selectat in query-urile care
  ajung la client.
- **Erori DB**: incalcarea unei chei unice devine 409 (nu 500), iar erorile
  necunoscute nu expun detalii SQL.
- Helmet si CORS restrictionat la originea frontend-ului.

## Consistenta si performanta

- **Chei straine** pe toate relatiile, cu `ON DELETE CASCADE / SET NULL /
  RESTRICT`. Stergerea unui profesor sau elev e un singur `DELETE` pe cont;
  restul se curata in baza. Rapoartele raman (cu `teacher_id = NULL`).
- **Tranzactii** pentru operatiile din mai multi pasi: cont + profil, nota +
  raport, decizie + modificare nota/purtare + raport, rotirea refresh
  tokenului, inlocuirea materiilor unui profesor.
- **Nota sau absenta**: o nota si o absenta trimise in acelasi timp pentru
  acelasi elev nu pot trece amandoua: verificarea se face in tranzactie,
  dupa ce randul elevului este blocat.
- **Concurenta**: deciziile directorului si cererile profesorilor blocheaza
  randul (`SELECT ... FOR UPDATE`), deci o cerere nu poate fi aprobata de doua
  ori. Orele predate se incrementeaza atomic in SQL.
- Paginare, cautare si sortare in SQL. Rapoartele folosesc paginare pe cursor
  (`WHERE id < :cursor ORDER BY id DESC LIMIT n+1`).
- Indecsi pe coloanele de filtrare/join si indecsi compusi pentru interogarile
  frecvente.

## Teste si lint

```bash
npm test          # 147 teste unit (Jest), fara DB
npm run test:cov
npm run lint
```

Server: autentificare (login, refresh cu rotire, refolosire, resetare
parola), guard-uri (roluri, parola temporara, director inactiv), CSRF,
configuratie, note (validari, teza, ora cu clasa elevului, duplicat,
tranzactie, cereri de editare), absente (ora, nota si absenta in aceeasi
zi, motivare), calculul mediilor (cu si fara teza,
rotunjiri), statistici (medii pe clasa, clasament, cei mai buni elevi),
orar (suprapuneri, "e la ora"), materii, purtare, paginare, validatorii de
nume si parola, date si varsta.

### Teste end-to-end

```bash
npm run test:e2e   # 21 teste pe API-ul real si MariaDB
```

Comanda face build la server, il porneste (`node dist/main.js`) pe o baza de
test separata si trimite requesturi HTTP reale, exact ca frontend-ul.
Foloseste datele de conectare `DB_*` din `.env`; baza de test se numeste
`catalog_digital_test` (se poate schimba cu `E2E_DB_NAME`) si este stearsa si
creata din nou la fiecare rulare. Din siguranta, numele ei trebuie sa se
termine in `_test`, ca testele sa nu poata sterge baza reala. Serverul de
test porneste cu `TIMETABLE_WEEKEND=true`, ca testele sa poata pune o ora
"acum" si cand ruleaza sambata sau duminica; normal orarul e doar luni-vineri.

Scenariul trece prin toata aplicatia: inregistrare scoala, profesori, elevi,
orar, prima autentificare cu parola temporara, note (validari, zecimale, o
nota pe zi, ora cu clasa elevului), teza, absente si motivarea lor, nota si
absenta trimise in acelasi timp, purtare, medii cu teza, statistici,
rapoarte cu paginare pe cursor, resetarea parolei si directorul inactiv.

## Ce se mai poate implementa

Aplicatia acopera fluxul complet al catalogului, dar pentru o folosire reala
in mai multe scoli ar mai fi nevoie de urmatoarele.

### Infrastructura

- **Docker**: cate un `Dockerfile` pentru API si pentru frontend si un
  `docker-compose.yml` cu API, frontend, MariaDB si Redis, ca proiectul sa
  porneasca cu o singura comanda. Migratiile ruleaza deja la pornire.
- **CI/CD** (de exemplu GitHub Actions): la fiecare pull request lint,
  typecheck, testele unit si build (in ambele repo-uri), plus testele e2e
  cu un serviciu MariaDB; la merge pe `main`, build de imagini Docker si
  deploy automat.
- **Endpoint de health** (`/api/health`, cu verificarea conexiunii la DB),
  folosit de Docker si de load balancer.
- **Backup automat** al bazei de date si un test periodic de restaurare.
- **Config pe medii** (dev / staging / productie) cu secretele intr-un
  secret manager, nu in `.env`.

### Monitorizare

- **Sentry** pe server si pe client, pentru erorile neprinse, cu userul si
  scoala atasate (fara date personale sensibile).
- **Loguri structurate** (de exemplu pino, in JSON) cu un id de request,
  ca o eroare sa poata fi urmarita de la client pana in baza de date.
- Metrici simple: timp de raspuns pe endpoint, numar de login-uri esuate.

### Documente (S3)

In viitor, aplicatia va pastra si documentele elevilor, ale profesorilor si
ale scolii: adeverinte medicale pentru motivarea absentelor, acte de inscriere
si foi matricole, contracte si diplome ale profesorilor, regulamente si
decizii ale scolii. Fisierele vor fi stocate pe **S3** (sau un serviciu
compatibil S3, de exemplu MinIO local sau Cloudflare R2), nu in baza de date
si nici pe discul serverului:

- In MariaDB ramane doar o tabela `documents` cu metadatele: scoala, tipul
  documentului, cui apartine (elev / profesor / scoala), numele fisierului,
  marimea, cheia din S3 si cine l-a incarcat.
- **Upload direct din browser** cu un URL presemnat (`PUT`, valabil cateva
  minute), ca fisierele mari sa nu treaca prin API. API-ul verifica inainte
  rolul, scoala, tipul si marimea fisierului.
- **Descarcare** tot prin URL presemnat, generat doar dupa verificarea
  drepturilor: directorul vede documentele scolii, profesorul pe ale lui, iar
  elevul pe ale lui. Bucket-ul ramane privat.
- Cheile din S3 sunt prefixate cu scoala (`schools/<schoolId>/...`), ca
  documentele scolilor sa ramana separate.
- Criptare la stocare, versionare in bucket (un document sters din greseala
  se poate recupera) si o regula de lifecycle pentru documentele vechi.

### Emailuri

- **Resend** pentru trimiterea emailurilor. Primul pas: linkul de resetare a
  parolei, care acum nu ajunge la utilizator in productie.
- **Mail la nota noua si la absenta** pentru elev (si parinte, vezi mai jos),
  cu materia si data. Similar la teza, la scaderea purtarii si la raspunsul
  directorului pentru cererile profesorilor.
- **Mail pentru contul nou**: profesorul sau elevul primeste linkul de login
  al scolii, in loc ca directorul sa trimita parola temporara manual.
- **Rezumat saptamanal** pentru director (note puse, cereri in asteptare).
- Trimiterea se face dintr-o coada (vezi Redis), nu in requestul care pune
  nota, ca un email picat sa nu blocheze salvarea.

### Performanta

- **Redis pentru caching**: statisticile (`/stats/classes`) se calculeaza
  acum la fiecare request din toate notele scolii; se pot tine in cache si
  invalida la nota noua, editare aprobata sau purtare schimbata. La fel
  listele `lookup` (clase, materii, profesori).
- **Redis pentru rate limiting**: limitele de login sunt acum in memoria
  procesului, deci nu functioneaza corect cu mai multe instante ale API-ului.
- **Coada de joburi** (BullMQ pe Redis) pentru emailuri, exporturi si
  calcule mai grele.

### Functionalitati scolare

- **Purtare calculata din absente**: ROFUIP scade purtarea cu un punct la
  fiecare 20 de absente nemotivate; acum absentele sunt inregistrate, dar
  purtarea se scade doar prin cererea profesorului.
- **Semestre / module si incheierea mediilor**: un an scolar cu perioade,
  media inchisa la final de perioada, avertizare cand un elev are mai putin
  de 4 note la o materie (minimul din ROFUIP) si situatia de corigenta.
- **Cont de parinte**, legat de unul sau mai multi elevi, care primeste
  notificarile de note si absente.
- **Diriginte**: tabela `class_teachers` exista deja in schema si poate fi
  folosita pentru dirigintele clasei, care sa vada situatia intregii clase.
- **Export** catalog si situatii scolare in PDF / Excel, export al
  rapoartelor in CSV.
- **Istoric pe ani scolari**: mediile se calculeaza acum pe anul curent;
  ar fi util un selector de an si arhivarea anilor incheiati.

### Calitate si securitate

- **Documentatie API** generata automat (Swagger / OpenAPI).
- **Autentificare in doi pasi** pentru directori si blocarea temporara a
  contului dupa mai multe parole gresite.
