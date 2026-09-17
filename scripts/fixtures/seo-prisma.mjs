// In-memory data for the isolated HTTP SEO check. Never connects to PostgreSQL.
// Only the SELECT operations used by the tested pages are implemented.
const treatment = { id: 'treatment', name: 'Igienizare dentară', slug: 'igienizare', description: 'Igienizare dentară sub supervizare.', isActive: true };
const city = { id: 'city', name: 'Cluj-Napoca', slug: 'cluj-napoca', isActive: true };
const now = new Date();
const startsAt = new Date(now);
startsAt.setUTCDate(startsAt.getUTCDate() + 1);
startsAt.setUTCHours(8, 0, 0, 0);
const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
const profiles = Array.from({ length: 14 }, (_, i) => ({
  id: `profile-${i}`, userId: `user-${i}`, publicSlug: `student-verificare-${i}`,
  isPublished: true, university: 'Universitate de test', studyYear: 4, bio: null,
  lastRefreshedAt: now, profileImage: null, appointments: [], availabilitySlots: [], supervisors: [],
  user: { id: `user-${i}`, name: `Student Verificare ${i}`, email: `student-${i}@example.invalid`, role: 'STUDENT', emailVerified: true },
}));
for (const [slug, overrides] of [
  ['nepublicat', { isPublished: false }],
  ['neverificat', { user: { emailVerified: false } }],
  ['student-demo-001', {}],
  ['demo-id-cu-slug-obisnuit', { id: 'demo-ui-directory-profile' }],
  ['demo-email-cu-slug-obisnuit', { user: { email: 'student@demo.universident.test' } }],
  ['demo-resurse-cu-slug-obisnuit', { supervisors: [{ id: 'demo-ui-supervisor-primary' }] }],
]) {
  const base = profiles[0];
  profiles.push({ ...base, id: slug, userId: slug, publicSlug: slug, ...overrides, user: { ...base.user, id: slug, ...overrides.user } });
}
const blocks = profiles.map((profile, index) => ({
  id: `block-${index}`, studentProfileId: profile.id, studentProfile: profile,
  status: 'ACTIVE', seriesId: null, startsAt, endsAt, studentLocationId: `location-${index}`,
  studentLocation: { id: `location-${index}`, routeKey: `loc-${index}`, name: 'Locație de test', address: 'Adresă de test', deletedAt: null, city },
  offerings: [{ id: `offering-${index}`, removedAt: null,
    studentTreatment: { durationMinutes: 60, description: null, deletedAt: null, treatment },
    supervisor: { fullName: 'Supervizor de test', academicTitle: null, deletedAt: null },
  }], appointments: [],
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
    return filtered.slice(0, spec.take ?? filtered.length).map((item) => select(item, { select: spec.select, include: spec.include }));
  }
  if (spec.select) return Object.fromEntries(Object.entries(spec.select).map(([key, choice]) => [key, choice === true ? value[key] : select(value[key], choice)]));
  if (spec.include) return { ...value, ...Object.fromEntries(Object.entries(spec.include).map(([key, choice]) => [key, choice === true ? value[key] : select(value[key], choice)])) };
  return value;
}
function model(rows, extra = {}) {
  return new Proxy({
    findMany: async (args = {}) => select(rows, args),
    findFirst: async (args = {}) => select(rows.find((row) => matches(row, args.where ?? {})) ?? null, args),
    ...extra,
  }, { get(target, name) {
    if (name in target) return target[name];
    throw new Error(`SEO fixture refuses unsupported operation: ${String(name)}`);
  } });
}
globalThis.prisma = new Proxy({
  studentProfile: model(profiles), studentAvailabilitySlot: model(blocks), studentAvailabilitySeries: model([]),
  treatment: model([treatment, { ...treatment, id: 'empty-treatment', slug: 'consultatie', name: 'Consultație' }]),
  city: model([city, { ...city, id: 'empty-city', slug: 'iasi', name: 'Iași' }]),
  appointmentReview: model([], { aggregate: async () => ({ _avg: { rating: null }, _count: { rating: 0 } }) }),
}, { get(target, name) {
  if (name in target) return target[name];
  throw new Error(`SEO fixture refuses database operation: ${String(name)}`);
} });
