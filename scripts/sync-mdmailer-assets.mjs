// Vendors the starter templates and sample host photos from the published @goatcheese/mdmailer
// package (mdmailer-core ships neither). Run `pnpm sync:mdmailer [version]` and commit the result.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = process.argv[2] ?? "0.2.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src/gadgets/email/mdmailer");
const isWin = process.platform === "win32";

const tmp = mkdtempSync(path.join(tmpdir(), "ntopia-mdmailer-"));
try {
  execFileSync("npm", ["pack", `@goatcheese/mdmailer@${VERSION}`, "--silent"], { cwd: tmp, stdio: "inherit", shell: isWin });
  const tarball = readdirSync(tmp).find((f) => f.endsWith(".tgz"));
  execFileSync("tar", ["-xzf", tarball], { cwd: tmp });

  const pkg = path.join(tmp, "package");
  for (const [from, to] of [
    ["templates", "templates"],
    ["assets/images/hosts", "assets/hosts"],
  ]) {
    rmSync(path.join(target, to), { recursive: true, force: true });
    mkdirSync(path.join(target, to), { recursive: true });
    cpSync(path.join(pkg, from), path.join(target, to), { recursive: true });
  }
  console.log(`Vendored @goatcheese/mdmailer@${VERSION} templates and host photos into ${path.relative(root, target)}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
