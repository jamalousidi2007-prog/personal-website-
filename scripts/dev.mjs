import net from "node:net";
import { execSync, spawn } from "node:child_process";
import path from "node:path";

const HOST = "localhost";
const START_PORT = Number(process.env.PORT || 30003);
const MAX_PORT = START_PORT + 25;
const cwd = process.cwd();
const nodeExe = process.execPath;
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

// ── Kill any process occupying a port (Windows) ──────────────────────────────
function killPort(port) {
  if (process.platform !== "win32") return;
  try {
    // Find PIDs listening on this port (IPv4 + IPv6)
    const raw = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids = new Set();
    for (const line of raw.split("\n")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[dev] Killed process ${pid} occupying port ${port}`);
      } catch {
        // process may have already exited
      }
    }
  } catch {
    // findstr returns exit code 1 when no match — that's fine
  }
}

// ── Check whether a port is free ─────────────────────────────────────────────
function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ host: HOST, port }, () => {
      server.close(() => resolve(true));
    });
  });
}

// ── Pick a free port, killing stale processes on the preferred one first ─────
async function pickPort() {
  // First attempt: kill anything on the preferred port and use it
  killPort(START_PORT);
  // Give the OS a brief moment to release the port
  await new Promise((r) => setTimeout(r, 600));
  if (await canListen(START_PORT)) return START_PORT;

  // Fallback: scan upward for any free port
  for (let port = START_PORT + 1; port <= MAX_PORT; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free port found between ${START_PORT} and ${MAX_PORT}.`);
}

const port = await pickPort();
console.log(`[dev] Starting Next.js on ${HOST}:${port}`);

const child = spawn(nodeExe, [nextBin, "dev", "-H", HOST, "-p", String(port)], {
  cwd,
  stdio: "inherit",
  windowsHide: true
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
