// demo data: creates schools, teachers, students and subjects through the API.
// Run with: npm run seed:mock (the API must be running, default port 3001).

const API = process.env.API_URL || 'http://localhost:3001/api';

const strongPass = 'Parola1!Strong';

function cookiesFrom(res) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookies ? { Cookie: options.cookies } : {}),
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return { data, cookies: cookiesFrom(res) };
}

// Monday to Friday, six 50 minute lessons from 08:00. At the same hour each
// class has a different subject, so no teacher has two lessons at once.
const LESSON_STARTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];

function lessonEnd(start) {
  const [hour] = start.split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:50`;
}

async function seedTimetable(cookies, classIds, subjectIds) {
  const classes = Object.entries(classIds);
  let count = 0;
  for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
    for (const [hourIndex, startTime] of LESSON_STARTS.entries()) {
      for (const [classIndex, [, classId]] of classes.entries()) {
        const subjectId =
          subjectIds[(hourIndex + classIndex) % subjectIds.length];
        await request('/timetable', {
          method: 'POST',
          cookies,
          body: {
            classId,
            subjectId,
            dayOfWeek,
            startTime,
            endTime: lessonEnd(startTime),
          },
        });
        count++;
      }
    }
  }
  console.log(`  + orar: ${count} ore (luni-vineri, 08:00-13:50)`);
}

async function seedSchool(school) {
  console.log(`\n== Scoala: ${school.name}`);
  const { cookies } = await request('/auth/register', {
    method: 'POST',
    body: {
      schoolName: school.name,
      slug: school.slug,
      address: school.address,
      phone: school.phone,
      directorEmail: school.directorEmail,
      password: strongPass,
    },
  });

  await request('/directors/me', {
    method: 'PATCH',
    cookies,
    body: {
      firstName: school.directorFirstName,
      lastName: school.directorLastName,
    },
  });

  console.log(`Director: ${school.directorEmail}`);

  const classIds = {};
  for (const name of new Set(school.students.map((s) => s.className))) {
    const { data } = await request('/classes', {
      method: 'POST',
      cookies,
      body: { name },
    });
    classIds[name] = data.id;
    console.log(`  + clasa ${name}`);
  }

  const subjectIds = [];
  for (const name of school.subjectNames) {
    const { data } = await request('/subjects', {
      method: 'POST',
      cookies,
      body: { name },
    });
    subjectIds.push(data.id);
    console.log(`  + materie ${name}`);
  }

  for (const t of school.teachers) {
    const { data: created } = await request('/teachers', {
      method: 'POST',
      cookies,
      body: {
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        temporaryPassword: strongPass,
      },
    });
    const subjectIdsForTeacher = t.subjectIndexes.map((i) => subjectIds[i]);
    await request(`/subjects/teacher/${created.id}`, {
      method: 'PUT',
      cookies,
      body: { subjectIds: subjectIdsForTeacher },
    });
    console.log(`  + profesor ${t.firstName} ${t.lastName}`);
  }

  for (const s of school.students) {
    await request('/students', {
      method: 'POST',
      cookies,
      body: {
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        birthDate: s.birthDate,
        classId: classIds[s.className],
        temporaryPassword: strongPass,
      },
    });
    console.log(`  + elev ${s.firstName} ${s.lastName} (${s.className})`);
  }

  await seedTimetable(cookies, classIds, subjectIds);

  return { slug: school.slug, directorEmail: school.directorEmail };
}

const SCHOOLS = [
  {
    name: 'Liceul Teoretic Mircea Eliade',
    slug: 'mircea-eliade',
    address: 'Str. Scoala 1, Bucuresti',
    phone: '0211111111',
    directorEmail: 'director@mircea-eliade.ro',
    directorFirstName: 'Ana',
    directorLastName: 'Popescu',
    subjectNames: ['Matematica', 'Limba Romana'],
    teachers: [
      {
        email: 'mate@mircea-eliade.ro',
        firstName: 'Ion',
        lastName: 'Ionescu',
        subjectIndexes: [0],
      },
      {
        email: 'romana@mircea-eliade.ro',
        firstName: 'Maria',
        lastName: 'Georgescu',
        subjectIndexes: [1],
      },
    ],
    students: [
      { email: 'elev1@mircea-eliade.ro', firstName: 'Andrei', lastName: 'Vasile', className: '9A', birthDate: '14-03-2011' },
      { email: 'elev2@mircea-eliade.ro', firstName: 'Elena', lastName: 'Dumitru', className: '9A', birthDate: '02-11-2010' },
      { email: 'elev3@mircea-eliade.ro', firstName: 'Radu', lastName: 'Marin', className: '10B', birthDate: '21-06-2010' },
    ],
  },
  {
    name: 'Colegiul National Spiru Haret',
    slug: 'spiru-haret',
    address: 'Bd. Republicii 10, Cluj',
    phone: '0264111222',
    directorEmail: 'director@spiru-haret.ro',
    directorFirstName: 'Mihai',
    directorLastName: 'Stan',
    subjectNames: ['Fizica'],
    teachers: [
      {
        email: 'fizica@spiru-haret.ro',
        firstName: 'Cristina',
        lastName: 'Neagu',
        subjectIndexes: [0],
      },
    ],
    students: [
      { email: 'elev1@spiru-haret.ro', firstName: 'Ioana', lastName: 'Petrescu', className: '11C', birthDate: '09-01-2009' },
      { email: 'elev2@spiru-haret.ro', firstName: 'Vlad', lastName: 'Toma', className: '11C', birthDate: '30-09-2008' },
    ],
  },
];

async function main() {
  console.log(`Seed pe ${API}`);
  console.log(`Parola pentru toate conturile demo: ${strongPass}`);

  for (const school of SCHOOLS) {
    await seedSchool(school);
  }

  console.log('\nGata.');
  console.log('Director: /login | profesori si elevi: /login/{slug-scoala}');
  console.log(
    'Notele si absentele se pot pune luni-vineri intre 08:00 si 13:50, in timpul orelor din orar.',
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
