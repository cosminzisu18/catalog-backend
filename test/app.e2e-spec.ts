// End-to-end tests on the real API and a real MariaDB database.
// Run with: npm run test:e2e (builds the server first). Needs the DB_* values
// from .env; the tests use their own database (E2E_DB_NAME, default
// catalog_digital_test), which is dropped and created again on every run.
// Some grades are dated 1-3 days ago, so on 1-3 September they fall in the
// previous school year and the average checks would not match.
import { ApiClient } from './helpers/api-client';
import { API_URL, startTestServer } from './helpers/test-server';

const PASSWORD = 'Parola1!Strong';
const NEW_PASSWORD = 'Parola2!Strong';

// dates and times are always Romania time, like on the server
function romaniaParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// dd-mm-yyyy, `daysAgo` days before today
function dayInRomania(daysAgo = 0): string {
  const p = romaniaParts();
  const date = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - daysAgo));
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

// a lesson that is happening right now, so grades and absences are allowed
function lessonAroundNow() {
  const p = romaniaParts();
  const hour = +p.hour;
  const pad = (n: number) => String(n).padStart(2, '0');
  const days: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    dayOfWeek: days[p.weekday],
    startTime: `${pad(Math.max(hour - 1, 0))}:00`,
    endTime: hour >= 22 ? '23:59' : `${pad(hour + 1)}:59`,
  };
}

describe('Catalog (e2e)', () => {
  let stopServer: () => Promise<void>;

  const slug = 'liceul-e2e';
  const director = new ApiClient(API_URL);
  const teacher = new ApiClient(API_URL);
  const student = new ApiClient(API_URL);

  // ids created along the way
  let mathId: number;
  let class9A: number;
  let class10B: number;
  let teacherId: number;
  let ana: number; // grades + thesis + lower conduct
  let bogdan: number; // one grade today
  let ioana: number; // absent today
  let radu: number; // in 10B, no lesson with him now
  let absenceId: number;
  let conductRequestId: number;

  const today = dayInRomania(0);

  beforeAll(async () => {
    stopServer = await startTestServer();
  }, 120_000);

  afterAll(async () => {
    await stopServer?.();
  });

  describe('school setup (director)', () => {
    it('registers a school and fills in the director name', async () => {
      const weak = await director.post('/auth/register', {
        schoolName: 'Liceul E2E',
        slug,
        directorEmail: `director@${slug}.ro`,
        password: 'slaba',
      });
      expect(weak.status).toBe(400);

      const res = await director.post('/auth/register', {
        schoolName: 'Liceul E2E',
        slug,
        directorEmail: `director@${slug}.ro`,
        password: PASSWORD,
      });
      expect(res.status).toBe(201);
      expect(res.body.user.mustCompleteProfile).toBe(true);

      const badName = await director.patch('/directors/me', {
        firstName: 'Dan3',
        lastName: 'Popa',
      });
      expect(badName.status).toBe(400);

      const name = await director.patch('/directors/me', {
        firstName: 'Dan',
        lastName: 'Popa',
      });
      expect(name.status).toBe(200);
    });

    it('creates a subject and two classes', async () => {
      mathId = (await director.post('/subjects', { name: 'Matematica' })).body
        .id;
      class9A = (await director.post('/classes', { name: '9A' })).body.id;
      class10B = (await director.post('/classes', { name: '10B' })).body.id;
      expect([mathId, class9A, class10B].every(Boolean)).toBe(true);

      const duplicate = await director.post('/classes', { name: '9A' });
      expect(duplicate.status).toBe(409);
    });

    it('adds a teacher and links them to the subject', async () => {
      const badName = await director.post('/teachers', {
        email: `x@${slug}.ro`,
        firstName: 'Ion<b>',
        lastName: 'X',
        temporaryPassword: PASSWORD,
      });
      expect(badName.status).toBe(400);

      const res = await director.post('/teachers', {
        email: `mate@${slug}.ro`,
        firstName: 'Ion',
        lastName: 'Ionescu',
        temporaryPassword: PASSWORD,
      });
      expect(res.status).toBe(201);
      teacherId = res.body.id;

      const link = await director.put(`/subjects/teacher/${teacherId}`, {
        subjectIds: [mathId],
      });
      expect(link.status).toBe(200);
    });

    it('adds students and checks names and birth dates', async () => {
      const add = (firstName: string, classId: number, extra = {}) =>
        director.post('/students', {
          email: `${firstName.toLowerCase()}@${slug}.ro`,
          firstName,
          lastName: 'Test',
          classId,
          temporaryPassword: PASSWORD,
          ...extra,
        });

      const withAge = await add('Ana', class9A, { birthDate: '14-03-2011' });
      expect(withAge.status).toBe(201);
      expect(withAge.body.age).toBeGreaterThanOrEqual(15);
      ana = withAge.body.id;

      bogdan = (await add('Bogdan', class9A)).body.id;
      ioana = (await add('Ioana', class9A)).body.id;
      radu = (await add('Radu', class10B)).body.id;

      expect(
        (await add('Mic', class9A, { birthDate: '01-01-2024' })).status,
      ).toBe(400);
      expect(
        (await add('Gresit', class9A, { birthDate: '31-02-2011' })).status,
      ).toBe(400);
      expect((await add('Elev2', class9A)).status).toBe(400);
    });

    it('puts a lesson in the timetable and refuses an overlapping one', async () => {
      const lesson = {
        classId: class9A,
        subjectId: mathId,
        ...lessonAroundNow(),
      };
      expect((await director.post('/timetable', lesson)).status).toBe(201);
      expect((await director.post('/timetable', lesson)).status).toBe(400);

      // 10B has math too, but not now
      const other = await director.post('/timetable', {
        classId: class10B,
        subjectId: mathId,
        dayOfWeek: lesson.dayOfWeek === 1 ? 2 : 1,
        startTime: '08:00',
        endTime: '08:50',
      });
      expect(other.status).toBe(201);
    });
  });

  describe('first login with a temporary password', () => {
    it('blocks the teacher until the password is changed', async () => {
      const login = await teacher.post(`/auth/login/${slug}`, {
        email: `mate@${slug}.ro`,
        password: PASSWORD,
      });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);

      expect((await teacher.get('/grades/mine')).status).toBe(403);

      const change = await teacher.post('/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      });
      expect(change.status).toBe(200);
      expect((await teacher.get('/grades/mine')).status).toBe(200);
    });
  });

  describe('grades (teacher)', () => {
    const grade = (body: object) =>
      teacher.post('/grades', { subjectId: mathId, gradedOn: today, ...body });

    it('refuses invalid values and dates', async () => {
      expect((await grade({ studentId: ana, value: 10.5 })).status).toBe(400);
      expect((await grade({ studentId: ana, value: 0 })).status).toBe(400);
      expect((await grade({ studentId: ana, value: 9.123 })).status).toBe(400);
      expect((await grade({ studentId: ana, value: '9' })).status).toBe(400);
      expect(
        (await grade({ studentId: ana, value: 9, gradedOn: '01-01-2099' }))
          .status,
      ).toBe(400);
      expect(
        (await grade({ studentId: ana, value: 9, gradedOn: '31-02-2026' }))
          .status,
      ).toBe(400);
    });

    it("refuses a grade outside the lesson with the student's class", async () => {
      const res = await grade({ studentId: radu, value: 9 });
      expect(res.status).toBe(400);
    });

    it('saves grades with decimals, one per student, subject and day', async () => {
      const first = await grade({ studentId: ana, value: 9.25 });
      expect(first.status).toBe(201);
      expect(first.body.value).toBe(9.25);
      expect(first.body.type).toBe('NORMAL');

      expect((await grade({ studentId: ana, value: 8 })).status).toBe(409);
      expect(
        (await grade({ studentId: ana, value: 8, gradedOn: dayInRomania(1) }))
          .status,
      ).toBe(201);
      expect((await grade({ studentId: bogdan, value: 10 })).status).toBe(201);
    });

    it('allows one thesis per subject in a school year', async () => {
      const thesis = await grade({
        studentId: ana,
        value: 7,
        type: 'THESIS',
        gradedOn: dayInRomania(2),
      });
      expect(thesis.status).toBe(201);
      expect(thesis.body.type).toBe('THESIS');

      const second = await grade({
        studentId: ana,
        value: 7,
        type: 'THESIS',
        gradedOn: dayInRomania(3),
      });
      expect(second.status).toBe(409);
    });
  });

  describe('absences', () => {
    it('allows either a grade or an absence per student, subject and day', async () => {
      // Ana already has a grade today
      const onGraded = await teacher.post('/absences', {
        studentId: ana,
        subjectId: mathId,
      });
      expect(onGraded.status).toBe(409);

      const absence = await teacher.post('/absences', {
        studentId: ioana,
        subjectId: mathId,
      });
      expect(absence.status).toBe(201);
      expect(absence.body.motivated).toBe(false);
      expect(absence.body.absentOn).toBe(today);
      absenceId = absence.body.id;

      const again = await teacher.post('/absences', {
        studentId: ioana,
        subjectId: mathId,
      });
      expect(again.status).toBe(409);

      const gradeWhenAbsent = await teacher.post('/grades', {
        studentId: ioana,
        subjectId: mathId,
        value: 9,
        gradedOn: today,
      });
      expect(gradeWhenAbsent.status).toBe(409);
      expect(gradeWhenAbsent.body.message).toContain('absenta');

      // another day is fine
      const otherDay = await teacher.post('/grades', {
        studentId: ioana,
        subjectId: mathId,
        value: 9,
        gradedOn: dayInRomania(1),
      });
      expect(otherDay.status).toBe(201);
    });

    it('does not accept a date for the absence', async () => {
      const res = await teacher.post('/absences', {
        studentId: bogdan,
        subjectId: mathId,
        absentOn: '2026-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('lets only the director motivate an absence, once', async () => {
      const mine = await teacher.get('/absences/mine');
      expect(mine.body.summary).toEqual({
        total: 1,
        motivated: 0,
        unmotivated: 1,
      });

      expect(
        (await teacher.patch(`/absences/${absenceId}/motivate`)).status,
      ).toBe(403);

      const motivate = await director.patch(`/absences/${absenceId}/motivate`, {
        reason: 'adeverinta medicala',
      });
      expect(motivate.status).toBe(200);
      expect(motivate.body.motivated).toBe(true);

      expect(
        (await director.patch(`/absences/${absenceId}/motivate`)).status,
      ).toBe(409);

      const list = await director.get(`/absences?studentId=${ioana}`);
      expect(list.body.items[0].motivatedReason).toBe('adeverinta medicala');
      expect(list.body.summary).toEqual({
        total: 1,
        motivated: 1,
        unmotivated: 0,
      });

      const unmotivated = await director.get('/absences?motivated=false');
      expect(unmotivated.body.items).toHaveLength(0);
    });
  });

  describe('conduct', () => {
    it('lowers the conduct grade only after the director approves', async () => {
      const notLower = await teacher.post('/conduct', {
        studentId: ana,
        proposedGrade: 10,
        teacherReason: 'Absente nemotivate',
      });
      expect(notLower.status).toBe(400);

      const request = await teacher.post('/conduct', {
        studentId: ana,
        proposedGrade: 9,
        teacherReason: 'Absente nemotivate',
      });
      expect(request.status).toBe(201);
      conductRequestId = request.body.id;

      const decide = await director.patch(
        `/conduct/${conductRequestId}/decide`,
        {
          approve: true,
          directorReason: 'De acord',
        },
      );
      expect(decide.status).toBe(200);

      const again = await director.patch(
        `/conduct/${conductRequestId}/decide`,
        {
          approve: true,
          directorReason: 'De acord',
        },
      );
      expect(again.status).toBe(409);
    });
  });

  describe('averages and stats', () => {
    // Ana:    normal grades 9.25 and 8 -> M = 8.62 (cut, not rounded)
    //         thesis 7 -> (3 * 8.62 + 7) / 4 = 8.215 -> 8
    //         general average (8 + conduct 9) / 2 = 8.50
    // Bogdan: 10 -> (10 + conduct 10) / 2 = 10.00
    // Ioana:  9 (yesterday) -> (9 + conduct 10) / 2 = 9.50
    it('computes the subject and general average with the thesis', async () => {
      const res = await director.get(`/stats/students/${ana}`);
      expect(res.status).toBe(200);
      expect(res.body.subjects).toEqual([
        expect.objectContaining({
          subjectName: 'Matematica',
          gradeCount: 3,
          average: 8.62,
          thesis: 7,
          final: 8,
        }),
      ]);
      expect(res.body.conductGrade).toBe(9);
      expect(res.body.generalAverage).toBe(8.5);
      expect(res.body.classRank).toBe(3);
      expect(res.body.classSize).toBe(3);
    });

    it('shows class averages and the best students to the director', async () => {
      const overview = await director.get('/stats/classes');
      const nineA = overview.body.classes.find(
        (c: { className: string }) => c.className === '9A',
      );
      expect(nineA.studentCount).toBe(3);
      expect(nineA.best.firstName).toBe('Bogdan');
      expect(
        overview.body.topStudents.map(
          (s: { firstName: string }) => s.firstName,
        ),
      ).toEqual(['Bogdan', 'Ioana', 'Ana']);

      const detail = await director.get(`/stats/classes/${class9A}`);
      expect(detail.body.students).toHaveLength(3);
    });

    it('lets a student see their own numbers, but not the school stats', async () => {
      await student.post(`/auth/login/${slug}`, {
        email: `ana@${slug}.ro`,
        password: PASSWORD,
      });
      await student.post('/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      const mine = await student.get('/stats/me');
      expect(mine.status).toBe(200);
      expect(mine.body.generalAverage).toBe(8.5);

      const grades = await student.get('/grades/my-grades');
      expect(grades.body.total).toBe(3);

      const absences = await student.get('/absences/me');
      expect(absences.body.summary.total).toBe(0);

      expect((await student.get('/stats/classes')).status).toBe(403);
      expect((await student.get('/absences')).status).toBe(403);
    });
  });

  describe('reports', () => {
    it('logs every action and pages the history with a cursor', async () => {
      const mine = await teacher.get('/reports/mine?limit=100');
      const types = mine.body.items.map((r: { type: string }) => r.type);
      expect(types).toEqual(
        expect.arrayContaining([
          'GRADE_CREATE',
          'ABSENCE_CREATE',
          'CONDUCT_REQUEST',
        ]),
      );

      const all = await director.get('/reports?limit=100');
      expect(all.body.items.map((r: { type: string }) => r.type)).toEqual(
        expect.arrayContaining(['ABSENCE_MOTIVATE', 'CONDUCT_DECISION']),
      );

      // walk through the history 3 at a time: no item twice, none missing
      const seen: number[] = [];
      let cursor: string | null = null;
      do {
        const page = await director.get(
          `/reports?limit=3${cursor ? `&cursor=${cursor}` : ''}`,
        );
        seen.push(...page.body.items.map((r: { id: number }) => r.id));
        cursor = page.body.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(all.body.items.length);
      expect(new Set(seen).size).toBe(seen.length);

      const search = await director.get('/reports?search=Teza');
      expect(search.body.items).toHaveLength(1);
    });
  });

  describe('password reset', () => {
    it('resets the password once with the link', async () => {
      const anonymous = new ApiClient(API_URL);
      const forgot = await anonymous.post('/auth/forgot-password', {
        email: `bogdan@${slug}.ro`,
      });
      expect(forgot.status).toBe(200);
      const token = new URL(forgot.body.devResetUrl).searchParams.get('token');

      const reset = await anonymous.post('/auth/reset-password', {
        token,
        newPassword: 'Resetata1!',
      });
      expect(reset.status).toBe(200);

      const reuse = await anonymous.post('/auth/reset-password', {
        token,
        newPassword: 'Resetata2!',
      });
      expect(reuse.status).toBe(400);

      const login = await anonymous.post(`/auth/login/${slug}`, {
        email: `bogdan@${slug}.ro`,
        password: 'Resetata1!',
      });
      expect(login.status).toBe(200);
    });
  });

  describe('grade and absence sent at the same time', () => {
    it('saves only one of them', async () => {
      // a new student with nothing today, so the race is the only thing
      // that decides what gets saved
      const elena = await director.post('/students', {
        email: `elena@${slug}.ro`,
        firstName: 'Elena',
        lastName: 'Test',
        classId: class9A,
        temporaryPassword: PASSWORD,
      });
      const studentId = elena.body.id;

      const results = await Promise.all([
        teacher.post('/grades', {
          studentId,
          subjectId: mathId,
          value: 10,
          gradedOn: today,
        }),
        teacher.post('/absences', { studentId, subjectId: mathId }),
        teacher.post('/grades', {
          studentId,
          subjectId: mathId,
          value: 9,
          gradedOn: today,
        }),
        teacher.post('/absences', { studentId, subjectId: mathId }),
      ]);
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(3);
    });
  });

  describe('inactive director', () => {
    it('can read but not change data after another director is activated', async () => {
      const second = await director.post('/directors', {
        email: `director2@${slug}.ro`,
        firstName: 'Maria',
        lastName: 'Ene',
        temporaryPassword: PASSWORD,
      });
      expect(second.status).toBe(201);
      expect(
        (await director.patch(`/directors/${second.body.id}/activate`)).status,
      ).toBe(200);

      expect(
        (await director.post('/subjects', { name: 'Fizica' })).status,
      ).toBe(403);
      expect((await director.get('/subjects')).status).toBe(200);
      expect(
        (
          await director.patch('/directors/me', {
            firstName: 'Dan',
            lastName: 'Popa',
          })
        ).status,
      ).toBe(200);
    });
  });
});
