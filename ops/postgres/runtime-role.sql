-- Run manually as the existing schema owner, after migrations, against the
-- verified intended database. No application rows or passwords are changed.
-- Set the password separately with psql: \password universident_app
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    runtime_id oid;
BEGIN
    IF current_user = 'universident_app' THEN
        RAISE EXCEPTION 'Use the existing migration/schema owner, not the runtime role';
    END IF;
    IF to_regclass('public._prisma_migrations') IS NULL THEN
        RAISE EXCEPTION 'Apply the reviewed application migrations before configuring the runtime role';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'universident_app') THEN
        CREATE ROLE universident_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
    SELECT oid INTO runtime_id FROM pg_roles WHERE rolname = 'universident_app';
    IF EXISTS (
        SELECT FROM pg_roles WHERE oid = runtime_id
        AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    ) OR EXISTS (SELECT FROM pg_auth_members WHERE member = runtime_id) THEN
        RAISE EXCEPTION 'The existing universident_app role has elevated privileges; review it manually';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE oid = runtime_id AND rolcanlogin) THEN
        RAISE EXCEPTION 'The existing universident_app role cannot log in; review it manually';
    END IF;
    IF EXISTS (SELECT FROM pg_class WHERE relowner = runtime_id AND relnamespace = 'public'::regnamespace) THEN
        RAISE EXCEPTION 'The runtime role must not own application tables';
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO universident_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO universident_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO universident_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO universident_app;
REVOKE ALL ON TABLE public._prisma_migrations FROM universident_app;

-- Future tables created by this migration owner remain usable by the app.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO universident_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO universident_app;

DO $$
BEGIN
    IF has_schema_privilege('universident_app', 'public', 'CREATE') THEN
        RAISE EXCEPTION 'The runtime role inherits schema CREATE privileges; review public/schema grants manually';
    END IF;
END $$;

COMMIT;
