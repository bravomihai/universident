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
  if (code !== 0) throw new Error(`Docker Compose a eșuat (${args[0]}).`);
}

async function stopApp() {
  const connection = createConnection(socketPath);
  connection.resume();
  try {
    await once(connection, "end", { signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) {
      throw new Error("Aplicația și workerul local nu s-au oprit în timpul disponibil.", { cause: error });
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
      throw new Error(`Portul ${port} este ocupat de alt proces. Oprește-l înainte de make dev.`);
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
    const stopped = once(app, "exit").then(() => { throw new Error("Procesul local s-a oprit."); });
    try {
      await Promise.race([once(app, "message", { signal }), stopped]);
      await Promise.race([waitForWeb(port, signal), stopped]);
    } catch (error) {
      if (app.pid && app.exitCode === null && app.signalCode === null) {
        const exited = once(app, "exit", { signal: AbortSignal.timeout(30_000) });
        app.kill("SIGTERM");
        await exited.catch(() => {});
      }
      throw new Error(`Pornirea aplicației locale a eșuat. Verifică ${logPath}.`, { cause: error });
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
  if (target !== "dev" && target !== "dev-stop") throw new Error("Folosește make dev sau make dev-stop.");
  const shouldStart = target === "dev";
  const port = Number(process.env.PORT || 3000);
  if (shouldStart) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Setează un PORT valid.");
    if (!existsSync("node_modules/next/dist/bin/next")) throw new Error("Instalează dependențele cu npm ci.");
  }
  await stopApp();
  if (shouldStart) await requireFreePort(port);
  await compose("stop", "db-dev");
  if (shouldStart) {
    await compose("up", "-d", "--wait", "--wait-timeout", "180", "db-dev");
    await startApp(port);
    console.log(`Mediul local rulează la http://localhost:${port}. Jurnal: ${logPath}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
