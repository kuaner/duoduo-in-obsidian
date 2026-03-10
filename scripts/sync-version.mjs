import fs from "fs";
import path from "path";

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const manifestPath = path.join(root, "manifest.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

manifest.version = pkg.version;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`Synced manifest.json version to ${pkg.version}`);

