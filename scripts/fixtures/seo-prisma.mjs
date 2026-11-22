// In-memory data for the isolated HTTP SEO check. Never connects to PostgreSQL.
// Only the SELECT operations used by the tested pages are implemented.
const treatment = { id: 'treatment', name: 'Igienizare dentară', slug: 'igienizare', description: 'Igienizare dentară sub supervizare.', isActive: true };
const city = { id: 'city', name: 'Cluj-Napoca', slug: 'cluj-napoca', isActive: true };
const now = new Date();
const startsAt = new Date(now);
startsAt.setUTCDate(startsAt.getUTCDate() + 1);
startsAt.setUTCHours(8, 0, 0, 0);
const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
const profiles = Array.from({ length: 15 }, (_, i) => ({
  id: `profile-${i}`, userId: `user-${i}`, publicSlug: `student-verificare-${i}`,
  isPublished: true, university: 'Universitate de test', studyYear: 4, bio: i === 14 ? 'Descriere publică fără ore disponibile' : null,
  lastRefreshedAt: new Date(now.getTime() - i * 60_000), publishedAt: now,
  profileImage: null, availabilitySlots: [], locations: [], showCompletedAppointmentsCount: i === 1 || i === 2,
  studentTreatments: i === 14 ? [
    { deletedAt: null, treatment: { name: 'Tratament vizibil de test', isActive: true } },
    { deletedAt: now, treatment: { name: 'Tratament arhivat de test', isActive: true } },
    { deletedAt: null, treatment: { name: 'Tratament inactiv de test', isActive: false } },
  ] : [],
  appointments: Array.from({ length: [30, 1, 24][i] ?? 0 }, () => ({ studentProfileId: "profile-" + i, status: "COMPLETED" })),
  user: { id: `user-${i}`, name: `Student Verificare ${i}`, email: `student-${i}@example.invalid`, role: 'STUDENT', emailVerified: true, signupPolicyVersion: 'declaratie-student-v1', signupPolicyConfirmedAt: now, policyConfirmations: [] },
}));
for (const [slug, overrides] of [
  ['nepublicat', { isPublished: false }],
  ['declaratie-lipsa', { user: { signupPolicyVersion: null } }],
  ['neverificat', { user: { emailVerified: false } }],
  ['student-demo-001', {}],
  ['demo-id-cu-slug-obisnuit', { id: 'demo-ui-directory-profile' }],
  ['demo-email-cu-slug-obisnuit', { user: { email: 'student@demo.universident.test' } }],
  ['demo-resurse-cu-slug-obisnuit', { locations: [{ id: 'demo-ui-location-primary' }] }],
]) {
  const base = profiles[0];
  profiles.push({ ...base, id: slug, userId: slug, publicSlug: slug, ...overrides, user: { ...base.user, id: slug, ...overrides.user } });
}
const blocks = profiles.filter((profile) => profile.id !== "profile-14").map((profile, index) => ({
  id: `block-${index}`, studentProfileId: profile.id, studentProfile: profile,
  status: 'ACTIVE', seriesId: null, startsAt, endsAt, studentLocationId: `location-${index}`,
  studentLocation: { id: `location-${index}`, routeKey: `loc-${index}`, name: 'Locație de test', address: 'Adresă de test', deletedAt: null, city },
  offerings: [{ id: `offering-${index}`, removedAt: null,
    studentTreatment: { durationMinutes: 60, description: null, deletedAt: null, treatment },
  }], appointments: [],
}));
const reviewRows = [
  { profile: profiles[1], rating: 4, publishedAt: now },
  { profile: profiles[2], rating: 5, publishedAt: now },
  { profile: profiles[2], rating: 4, publishedAt: now },
  { profile: profiles[3], rating: 5, publishedAt: null },
].map(({ profile, rating, publishedAt }, index) => ({
  id: "review-fixture-" + index,
  targetUserId: profile.userId,
  target: { studentProfile: profile },
  authorRole: "PATIENT", rating, publishedAt, comment: null,
  author: { name: "Pacient fictiv", patientProfile: null, studentProfile: null },
  appointment: { treatmentNameSnapshot: treatment.name, scheduledStartsAt: startsAt },
}));

function matches(value, where) {
  if (where === null || typeof where !== 'object' || where instanceof Date) return value === where;
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined || key === 'mode') return true;
    if (key === 'AND') return [].concat(condition).every((item) => matches(value, item));
    if (key === 'OR') return condition.some((item) => matches(value, item));
    if (key === 'NOT') return [].concat(condition).every((item) => !matches(value, item));
    if (key === 'not') return !matches(value, condition);
    if (key === 'in') return condition.includes(value);
    if (key === 'some') return value?.some((item) => matches(item, condition));
    if (key === 'startsWith') return typeof value === 'string' && value.startsWith(condition);
    if (key === 'endsWith') return typeof value === 'string' && value.toLowerCase().endsWith(condition.toLowerCase());
    if (key === 'gt') return value > condition;
    if (key === 'gte') return value >= condition;
    if (key === 'lt') return value < condition;
    if (key === 'lte') return value <= condition;
    return matches(value?.[key], condition);
  });
}
function select(value, spec) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    const filtered = value.filter((item) => matches(item, spec.where ?? {}));
    const offset = spec.skip ?? 0;
    return filtered.slice(offset, offset + (spec.take ?? filtered.length)).map((item) => select(item, { select: spec.select, include: spec.include }));
  }
  if (spec.select) return Object.fromEntries(Object.entries(spec.select).map(([key, choice]) => {
    if (key === "_count") {
      const entries = Object.entries(choice.select).map(([relation, filter]) => [relation, value[relation].filter((item) => matches(item, filter.where)).length]);
      return [key, Object.fromEntries(entries)];
    }
    return [key, choice === true ? value[key] : select(value[key], choice)];
  }));
  if (spec.include) return { ...value, ...Object.fromEntries(Object.entries(spec.include).map(([key, choice]) => [key, choice === true ? value[key] : select(value[key], choice)])) };
  return value;
}
function model(rows, extra = {}) {
  return new Proxy({
    findMany: async (args = {}) => select(rows, args),
    count: async (args = {}) => rows.filter((row) => matches(row, args.where ?? {})).length,
    findFirst: async (args = {}) => select(rows.find((row) => matches(row, args.where ?? {})) ?? null, args),
    ...extra,
  }, { get(target, name) {
    if (name in target) return target[name];
    throw new Error(`SEO fixture refuses unsupported operation: ${String(name)}`);
  } });
}
globalThis.prisma = new Proxy({
  // Better Auth probes this optional metadata before using the read-only double.
  _runtimeDataModel: undefined,
  studentProfile: model(profiles), studentAvailabilitySlot: model(blocks), studentAvailabilitySeries: model([]),
  treatment: model([treatment, { ...treatment, id: 'empty-treatment', slug: 'consultatie', name: 'Consultație' }]),
  city: model([city, { ...city, id: 'empty-city', slug: 'iasi', name: 'Iași' }]),
  $transaction: async (callback) => callback(globalThis.prisma),
  appointment: model(profiles.slice(0, 15).flatMap((profile) => profile.appointments)),
  appointmentReview: model(reviewRows, {
    aggregate: async ({ where }) => {
      const selected = reviewRows.filter((row) => matches(row, where));
      return { _avg: { rating: selected.length ? selected.reduce((total, row) => total + row.rating, 0) / selected.length : null }, _count: { rating: selected.length } };
    },
    groupBy: async ({ where }) => {
      const rowsByUser = new Map();
      for (const row of reviewRows.filter((item) => matches(item, where))) {
        const rows = rowsByUser.get(row.targetUserId) ?? [];
        rows.push(row);
        rowsByUser.set(row.targetUserId, rows);
      }
      return [...rowsByUser].map(([targetUserId, rows]) => ({
        targetUserId,
        _avg: { rating: rows.reduce((total, row) => total + row.rating, 0) / rows.length },
        _count: { rating: rows.length },
      }));
    },
  }),
}, { get(target, name) {
  if (name in target) return target[name];
  throw new Error(`SEO fixture refuses database operation: ${String(name)}`);
} });
