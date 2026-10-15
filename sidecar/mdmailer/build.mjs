// Prepares the mdmailer sidecar for Tauri:
//   src-tauri/binaries/node-<target-triple>   portable official Node runtime (externalBin)
//   src-tauri/resources/mdmailer/             @goatcheese/mdmailer + its node_modules (resources)
// mdmailer relies on native modules (sharp) and Puppeteer, so it can't be compiled into one binary;
// it runs as `node <resources>/mdmailer/cli.js`.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, chmodSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NODE_VERSION = "v24.11.0";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const tauri = path.join(root, "src-tauri");

const triple = execFileSync("rustc", ["-vV"], { encoding: "utf8" }).match(/host: (.+)/)[1];
const isWin = triple.includes("windows");
const os = triple.includes("apple") ? "darwin" : isWin ? "win" : "linux";
const arch = triple.startsWith("aarch64") ? "arm64" : "x64";
const ext = isWin ? "zip" : "tar.gz";
const base = `node-${NODE_VERSION}-${os}-${arch}`;

// 1. Node runtime
const dest = path.join(tauri, "binaries", `node-${triple}${isWin ? ".exe" : ""}`);
if (!existsSync(dest)) {
  const tmp = mkdtempSync(path.join(tmpdir(), "ntopia-node-"));
  const archive = path.join(tmp, `${base}.${ext}`);
  console.log(`Downloading ${base}.${ext}…`);
  execFileSync("curl", ["-fsSL", "-o", archive, `https://nodejs.org/dist/${NODE_VERSION}/${base}.${ext}`], { stdio: "inherit" });
  execFileSync("tar", ["-xf", archive, "-C", tmp], { stdio: "inherit" });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(path.join(tmp, base, isWin ? "node.exe" : path.join("bin", "node")), dest);
  if (!isWin) chmodSync(dest, 0o755);
  rmSync(tmp, { recursive: true, force: true });
}

// 2. mdmailer + production dependencies
execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: here, stdio: "inherit", shell: isWin });
const res = path.join(tauri, "resources", "mdmailer");
rmSync(res, { recursive: true, force: true });
mkdirSync(res, { recursive: true });
cpSync(path.join(here, "node_modules"), path.join(res, "node_modules"), { recursive: true, dereference: true });
console.log(`Sidecar ready: ${dest}\nResources: ${res} (${readdirSync(path.join(res, "node_modules")).length} packages)`);
