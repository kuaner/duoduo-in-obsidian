import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";

const prod = process.argv[2] === "production";
const outDir = "dist";

// 确保输出目录存在
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/closebrackets",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/comment",
    "@codemirror/fold",
    "@codemirror/gutter",
    "@codemirror/highlight",
    "@codemirror/history",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/matchbrackets",
    "@codemirror/panel",
    "@codemirror/rangeset",
    "@codemirror/rectangular-selection",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/stream-parser",
    "@codemirror/text",
    "@codemirror/tooltip",
    "@codemirror/view",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: `${outDir}/main.js`,
});

// 每次构建完成后复制 manifest.json 和 styles.css 到 dist/
function copyStaticFiles() {
  fs.copyFileSync("manifest.json", `${outDir}/manifest.json`);
  fs.copyFileSync("styles.css", `${outDir}/styles.css`);
}

if (prod) {
  await context.rebuild();
  copyStaticFiles();
  console.log(`\nBuild complete. Copy the contents of dist/ to your plugin folder:\n  .obsidian/plugins/duoduo-in-obsidian/\n`);
  process.exit(0);
} else {
  // dev 模式：监听文件变化，每次 rebuild 后同步静态文件
  await context.watch();
  copyStaticFiles();
  console.log("\nWatching for changes... (Ctrl+C to stop)");

  // 同时监听 manifest.json 和 styles.css 的变化
  for (const file of ["manifest.json", "styles.css"]) {
    fs.watch(file, () => {
      copyStaticFiles();
      console.log(`[watch] ${file} updated`);
    });
  }
}
