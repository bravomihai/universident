import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

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
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  web.kill(signal);
  emails.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
web.on("error", () => { console.error("Serverul local nu a putut fi pornit."); stop(); process.exitCode = 1; });
web.on("exit", (code) => { stop(); process.exitCode = code ?? 0; });
emails.on("error", () => console.error("Procesul notificărilor email nu a putut fi pornit."));
emails.on("exit", (code) => {
  if (!stopping) console.error(`Notificările email s-au oprit (cod ${code ?? "necunoscut"}). Verifică configurația și repornește npm run dev.`);
});
