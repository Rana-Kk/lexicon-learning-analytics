# Lexicon Learning Analytics — API

Node.js + Express + MySQL 8. Katmanlı yapı: `routes → controllers → (doğrudan `pool.query`, model katmanı yok — proje küçük, ORM'e gerek yok).

## Kurulum

```bash
cd backend
npm install
cp .env.example .env
```

`.env` içini local MySQL bilgilerinle doldur (`DB_USER`, `DB_PASSWORD`, vs.). MySQL'in çalışıyor olması ve `lexicon_learning_analytics` adında henüz bir veritabanı olmaması yeterli — script veritabanını kendisi oluşturuyor.

```bash
npm run db:init   # schema_v2.sql'i uygular, tüm tabloları oluşturur
npm run dev        # http://localhost:4000
```

## Klasör yapısı

```
src/
  config/db.js          mysql2 connection pool
  server.js              entry point, DB bağlantısını test edip Express'i başlatır
  app.js                 route'ların toplandığı yer
  middleware/
    auth.js               JWT doğrulama (authenticate) + rol kontrolü (requireRole)
    errorHandler.js        merkezi hata yakalama
  controllers/            iş mantığı + SQL sorguları
  routes/                 URL -> controller eşlemesi
  db/
    schema_v2.sql          şema
    init.js                 şemayı uygulayan script
  utils/
    ApiError.js             `throw new ApiError(404, 'mesaj')` deseni
    asyncHandler.js         controller'larda try/catch tekrarını önler
```

## Şu an hazır olan uç noktalar

```
POST   /api/auth/register     { name, email, password, role }
POST   /api/auth/login        { email, password } -> { user, token }
GET    /api/auth/me           (auth gerekir)

GET    /api/courses
GET    /api/courses/:id
POST   /api/courses           (admin)
PUT    /api/courses/:id       (admin)
DELETE /api/courses/:id       (admin)

GET    /api/groups            (role'e göre filtrelenir: admin hepsini, öğretmen
                                sadece kendi grubunu, öğrenci sadece kendi grubunu görür)
GET    /api/groups/:id
GET    /api/groups/:id/students
POST   /api/groups             (admin)
POST   /api/groups/:id/teachers   { teacher_id }   (admin)
POST   /api/groups/:id/students   { student_id }   (admin)
```

Tüm istekler `Authorization: Bearer <token>` header'ı ile korunuyor (auth/register ve auth/login hariç). Parantez içi rol belirtilmemiş satırlar auth gerektirir ama herhangi bir role açıktır (genelde kendi verisiyle sınırlı).

Auth                         /api/auth
POST   /register              { name, email, password, role }  (admin)
POST   /login                 { email, password } -> { user, token }
POST   /change-password
GET    /me

Courses                      /api/courses
GET    /
GET    /:id
POST   /                      (admin)
PUT    /:id                   (admin)
DELETE /:id                   (admin)

Groups                       /api/groups
GET    /my                    (teacher — kendi grupları)
GET    /                      (role'e göre filtrelenir)
GET    /:id
POST   /                      (admin, teacher)
PUT    /:id                   (admin, teacher)
DELETE /:id                   (admin)
GET    /:id/students          (admin, teacher)
POST   /:id/students          (admin, teacher)
DELETE /:id/students/:studentId (admin)
GET    /:id/teachers          (admin, teacher)
POST   /:id/teachers          (admin)
DELETE /:id/teachers/:teacherId (admin)

Teams                        /api/teams
GET    /
GET    /my
POST   /                      (admin, teacher)
PUT    /:id                   (admin, teacher)
DELETE /:id                   (admin, teacher)
POST   /:id/members           (admin, teacher)
DELETE /:id/members/:studentId (admin, teacher)

Users                        /api/users
PATCH  /profile/github
GET    /                      (admin, teacher)
GET    /:id
POST   /                      (admin)
POST   /import-students       (admin)
POST   /import-students/excel (admin)
PUT    /:id
DELETE /:id                   (admin)

Assessments                  /api/assessments
GET    /student               (öğrencinin kendi assessment'ları)
GET    /
GET    /:id
POST   /                      (admin, teacher)
PUT    /:id                   (admin, teacher)
DELETE /:id                   (admin, teacher)

Submissions (GitHub tabanlı)  /api/submissions
GET    /
GET    /:id
POST   /                      (student, admin)
PUT    /:id/review            (teacher, admin)   -> AI taslağını onaylar/düzenler

Attendance                   /api/attendance
GET    /
GET    /student/:studentId/summary
GET    /group/:groupId/summary  (admin, teacher)
POST   /bulk                  (admin, teacher)
GET    /appeals               (öğrencinin kendi itirazları)
POST   /appeals               (öğrenci — kendi devamsızlığına itiraz)
GET    /appeals/pending       (admin, teacher)
PUT    /appeals/:id/review    (admin, teacher)

Quizzes                      /api/quizzes
GET    /results
POST   /results                (admin, teacher, student)
POST   /results/import         (admin, teacher)
GET    /
GET    /:id
POST   /                       (admin, teacher)
PUT    /:id                    (admin, teacher)
DELETE /:id                    (admin, teacher)

Competencies                 /api/competencies
GET    /
POST   /                       (admin, teacher)
GET    /student/:studentId
GET    /student/:studentId/history
GET    /me
PUT    /student                (admin, teacher)
GET    /group/:groupId         (admin, teacher)
POST   /group                  (admin, teacher)
DELETE /group/:groupId/:competencyId (admin, teacher)

Feedback                     /api/feedback
GET    /templates
POST   /templates              (admin, teacher)
DELETE /templates/:id          (admin, teacher)
GET    /
POST   /                       (admin, teacher)
DELETE /:id                    (admin, teacher)

Certificates                 /api/certificates
GET    /
POST   /                       (admin, teacher, student)
PUT    /:id                    (admin, teacher, student)
DELETE /:id                    (admin, teacher)

Analytics                    /api/analytics
GET    /overview               (öğretmen/öğrenci kendi kapsamına, admin tümüne)
GET    /groups                 (admin, teacher)
GET    /students               (admin, teacher)

Reports                      /api/reports
GET    /student/:studentId
GET    /me## Yeni bir kaynak eklerken izlenecek desen

Örnek: `assessments` için:

1. `controllers/assessments.controller.js` — `listAssessments`, `getAssessment`, `createAssessment` vs. (courses.controller.js'e bak, aynı desen)
2. `routes/assessments.routes.js` — `authenticate` + gerekirse `requireRole(...)`
3. `app.js`'e `app.use('/api/assessments', assessmentsRoutes)` satırını ekle

Sıradaki mantıklı adımlar (proposal'daki MUST HAVE sırasına göre): `users` (admin'in öğretmen/öğrenci eklemesi), `assessments` + `assessment_criteria`, `assessment_submissions`, sonra GitHub polling job + AI evaluation entegrasyonu.

## Bilinmesi gerekenler

- `authenticate` middleware'i her route dosyasının başında `router.use(authenticate)` ile uygulanıyor — yeni route dosyası eklerken unutma.
- `requireRole('admin')` gibi çağrılar sadece o role sahip kullanıcıyı geçiriyor; birden fazla rol için `requireRole('admin', 'teacher')`.
- `groups.controller.js`'teki `assertGroupAccess` fonksiyonu, öğretmen/öğrencinin sadece kendi grubuna erişebilmesini sağlıyor (proposal §4: "Teachers should only have access to the groups and students assigned to them") — yeni group-scoped endpoint eklerken bu fonksiyonu tekrar kullan.
- Şifre hash'leme için tek paket kullanılıyor: `bcryptjs` (önceden `bcrypt` de yüklüydü, kaldırıldı — import'larda değişken adı hâlâ `bcrypt` ama kaynağı `bcryptjs`).
- `.gitignore` var: `node_modules/`, `.env`, `.DS_Store` repo'ya girmiyor — gerçek `.env`'i asla commit'leme, sadece `.env.example`'ı güncel tut.