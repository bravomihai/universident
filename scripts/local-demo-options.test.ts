import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalDemoDatabase, parseLocalDemoOptions } from "./lib/local-demo-options";

test("demo seed refuses production, remote hosts, deceptive hosts and non-PostgreSQL URLs", () => {
  for (const url of [
    "postgresql://demo:example@db.example.com/app",
    "postgresql://localhost@db.example.com/app",
    "postgresql://demo:example@localhost.example.com/app",
    "https://localhost/app",
  ]) {
    assert.throws(() => assertLocalDemoDatabase(url, "development"));
  }
  assert.throws(() => assertLocalDemoDatabase("postgresql://localhost/app", "production"));
  assert.throws(() => assertLocalDemoDatabase(undefined, "development"));
  assert.throws(() => assertLocalDemoDatabase("not-a-url", "development"), /nu este un URL/);
});

test("demo seed accepts only explicit local PostgreSQL targets", () => {
  for (const url of [
    "postgresql://localhost:5432/app",
    "postgres://127.0.0.1:5432/app",
    "postgresql://[::1]:5432/app",
  ]) assert.doesNotThrow(() => assertLocalDemoDatabase(url, "development"));
});

test("dry-run can select booking and cooldown without enabling writes", () => {
  assert.deepEqual(parseLocalDemoOptions(["--dry-run", "--scenario=booking", "--refresh=cooldown"]), {
    dryRun: true, directoryOnly: false, scenario: "booking", refresh: "cooldown",
  });
  assert.throws(() => parseLocalDemoOptions(["--dryrun"]), /necunoscută/);
  assert.throws(() => parseLocalDemoOptions(["--scenario=unknown"]), /necunoscută/);
  assert.throws(() => parseLocalDemoOptions(["--patient-email="]), /adresă de email/);
  assert.equal(parseLocalDemoOptions(["--patient-email=Patient@Example.test"]).patientEmail, "patient@example.test");
});

test("directory-only does not require existing account selectors and supports dry-run", () => {
  assert.deepEqual(parseLocalDemoOptions(["--directory-only", "--dry-run"]), {
    directoryOnly: true, dryRun: true, scenario: "full", refresh: "available",
  });
});
