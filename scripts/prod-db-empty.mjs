import pg from "pg";

const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await database.connect();
  // Treat any object in the Prisma schema, including migration history, as an existing installation.
  const { rows } = await database.query(
    `SELECT NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend
      WHERE refclassid = 'pg_catalog.pg_namespace'::regclass
        AND refobjid = 'public'::regnamespace
    ) AS empty`,
  );
  console.log(rows[0].empty);
} catch {
  console.error("Could not check whether the production database schema is empty.");
  process.exitCode = 1;
} finally {
  await database.end();
}
