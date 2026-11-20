import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

// Match Next's local-development file precedence; explicit environment values win.
const envFiles = [".env", ".env.development", ".env.local", ".env.development.local"]
  .filter((file) => existsSync(file))
  .map((file) => `--env-file=${file}`);
const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit", windowsHide: true,
});
const emails = spawn(process.execPath, [...envFiles, "scripts/chat-email-worker.mjs"], {
  stdio: "inherit", windowsHide: true,
});
let stopping = false;
const controlSocket = process.env.UNIVERSIDENT_DEV_CONTROL_SOCKET;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  web.kill(signal);
  emails.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
web.on("error", () => { console.error("The local server could not start."); stop(); process.exitCode = 1; });
web.on("exit", (code) => { stop(); process.exitCode ??= code ?? 0; });
emails.on("error", () => {
  console.error("The chat email worker could not start.");
  if (controlSocket) {
    process.exitCode = 1;
    stop();
  }
});
emails.on("exit", (code) => {
  if (stopping) return;
  console.error(`The chat email worker stopped (exit code: ${code ?? "unknown"}). Check the configuration and restart the local stack.`);
  if (controlSocket) {
    process.exitCode = code || 1;
    stop();
  }
});

if (controlSocket) {
  const control = createServer((connection) => {
    // Keep the connection open until both child processes have exited.
    connection.on("error", () => {});
    connection.unref();
    stop();
  });
  control.on("error", (error) => {
    console.error("Could not start the local control socket:", error.message);
    process.exitCode = 1;
    stop();
  });
  control.listen(controlSocket, () => {
    control.unref();
    process.send?.("listening", () => {});
  });
}
