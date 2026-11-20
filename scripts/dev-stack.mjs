import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const socketPath = ".local-dev/control.sock";
const logPath = ".local-dev/app.log";
const composeArgs = ["compose", "-f", "compose.yaml", "--profile", "dev"];

async function compose(...args) {
  const command = spawn("docker", [...composeArgs, ...args], { stdio: "inherit" });
  const [code] = await once(command, "exit");
  if (code !== 0) throw new Error(`Docker Compose failed (${args[0]}).`);
}

async function runNpmTask(task, errorMessage, env = process.env) {
  const command = spawn("npm", ["run", task], { env, stdio: "inherit" });
  const [code] = await once(command, "exit");
  if (code !== 0) throw new Error(errorMessage);
}

async function prepareLocalDatabase() {
  const { default: nextEnv } = await import("@next/env");
  const { loadEnvConfig, resetEnv } = nextEnv;
  const databaseUrl = loadEnvConfig(process.cwd(), true).combinedEnv.DATABASE_URL;
  resetEnv();

  const url = URL.canParse(databaseUrl) ? new URL(databaseUrl) : null;
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Set DATABASE_URL to a valid PostgreSQL URL.");
  }
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname)
    || (url.port || "5432") !== "5432"
    || url.pathname !== "/universident"
    || url.searchParams.has("host")
  ) {
    console.log("Skipping automatic database setup for DATABASE_URL outside the local Compose database.");
    return;
  }

  url.hostname = "127.0.0.1";
  const env = { ...process.env, DATABASE_URL: url.href };
  for (const [task, errorMessage] of [
    ["db:deploy", "Could not apply local database migrations."],
    ["db:seed", "Could not seed the local database catalogs."],
  ]) {
    await runNpmTask(task, errorMessage, env);
  }
}

async function stopApp() {
  const connection = createConnection(socketPath);
  connection.resume();
  try {
    await once(connection, "end", { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) {
      throw new Error("Timed out waiting for the local app and worker to stop.", { cause: error });
    }
  } finally {
    connection.destroy();
  }
  await rm(socketPath, { force: true });
}

async function requireFreePort(port) {
  const listener = createServer();
  listener.listen(port);
  try {
    await once(listener, "listening");
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      throw new Error(`Port ${port} is in use by another process. Stop it before running make dev.`);
    }
    throw error;
  }
  listener.close();
  await once(listener, "close");
}

async function waitForWeb(port, signal) {
  while (!signal.aborted) {
    const connection = createConnection({ port, host: "127.0.0.1" });
    try {
      await once(connection, "connect", { signal });
      return;
    } catch (error) {
      if (error.code !== "ECONNREFUSED") throw error;
    } finally {
      connection.destroy();
    }
    await delay(200, undefined, { signal });
  }
  signal.throwIfAborted();
}

async function startApp(port) {
  const log = await open(logPath, "w", 0o600);
  try {
    const app = spawn(process.execPath, ["scripts/dev.mjs", "--port", String(port)], {
      detached: true,
      env: { ...process.env, UNIVERSIDENT_DEV_CONTROL_SOCKET: socketPath },
      stdio: ["ignore", log.fd, log.fd, "ipc"],
    });
    const startup = new AbortController();
    const signal = AbortSignal.any([startup.signal, AbortSignal.timeout(60_000)]);
    const stopped = once(app, "exit").then(() => { throw new Error("The local process exited."); });
    try {
      await Promise.race([once(app, "message", { signal }), stopped]);
      await Promise.race([waitForWeb(port, signal), stopped]);
    } catch (error) {
      if (app.pid && app.exitCode === null && app.signalCode === null) {
        const exited = once(app, "exit", { signal: AbortSignal.timeout(30_000) });
        app.kill("SIGTERM");
        await exited.catch(() => {});
      }
      throw new Error(`The local app failed to start. Check ${logPath}.`, { cause: error });
    } finally {
      startup.abort();
      if (app.connected) app.disconnect();
      app.unref();
    }
  } finally {
    await log.close();
  }
}

try {
  const target = process.argv[2];
  if (target !== "dev" && target !== "dev-stop") throw new Error("Run make dev or make dev-stop.");
  const shouldStart = target === "dev";
  const port = Number(process.env.PORT || 3000);
  if (shouldStart) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Set PORT to an integer between 1 and 65535.");
    if (!existsSync("node_modules/next/dist/bin/next")) throw new Error("Install dependencies with npm ci.");
  }
  await stopApp();
  if (shouldStart) {
    await requireFreePort(port);
    await runNpmTask("db:generate", "Could not generate Prisma Client.");
  }
  await compose("stop", "db-dev");
  if (shouldStart) {
    await compose("up", "-d", "--wait", "--wait-timeout", "180", "db-dev");
    await prepareLocalDatabase();
    await startApp(port);
    console.log(`The local app is running at http://localhost:${port}. Log file: ${logPath}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
