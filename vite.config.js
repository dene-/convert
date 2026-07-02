import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";
import { existsSync } from "node:fs";

const staticTargets = [
  {
    src: "node_modules/@flo-audio/reflo/reflo_bg.wasm",
    dest: "wasm"
  },
  {
    src: "src/handlers/pandoc/pandoc.wasm",
    dest: "wasm"
  },
  {
    src: "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*",
    dest: "wasm"
  },
  {
    src: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm",
    dest: "wasm"
  },
  {
    src: "src/handlers/libopenmpt/libopenmpt.wasm",
    dest: "wasm"
  },
  {
    src: "src/handlers/libopenmpt/libopenmpt.js",
    dest: "wasm"
  },
  {
    src: "node_modules/js-synthesizer/externals/libfluidsynth-2.4.6.js",
    dest: "wasm"
  },
  {
    src: "node_modules/js-synthesizer/dist/js-synthesizer.js",
    dest: "wasm"
  },
  {
    src: "src/handlers/midi/TimGM6mb.sf2",
    dest: "wasm"
  },
  {
    src: "src/handlers/espeakng.js/js/espeakng.worker.js",
    dest: "js"
  },
  {
    src: "src/handlers/espeakng.js/js/espeakng.worker.data",
    dest: "js"
  },
  {
    src: "node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs",
    dest: "js"
  },
  {
    src: "node_modules/turbowarp-packager-browser/dist/scaffolding/*",
    dest: "js/turbowarp-scaffolding"
  },
  {
    src: "node_modules/7z-wasm/7zz.wasm",
    dest: "wasm"
  },
  {
    src: "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
    dest: "wasm"
  },
  {
    src: "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
    dest: "wasm"
  }
];

if (existsSync("cache.json")) {
  staticTargets.push({
    src: "cache.json",
    dest: "."
  });
}

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@ffmpeg/ffmpeg",
      "@sqlite.org/sqlite-wasm",
      "@bokuweb/zstd-wasm",
      "@yowasp/clang",
    ]
  },
  base: "/convert/",
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith("/src/normalizeMimeType.ts")) return "app-core";
          if (id.includes("/src/handlers/")) {
            const match = id.match(/\/src\/handlers\/([^/]+?)(?:\.ts|\.js|\/)/);
            return match ? `handler-${match[1]}` : "handlers";
          }
          if (!id.includes("node_modules")) return;
          if (id.includes("@ffmpeg")) return "vendor-ffmpeg";
          if (id.includes("@imagemagick")) return "vendor-imagemagick";
          if (id.includes("@sqlite.org")) return "vendor-sqlite";
          if (id.includes("@myriaddreamin")) return "vendor-typst";
          if (id.includes("7z-wasm")) return "vendor-archive";
          if (id.includes("pdf-parse")) return "vendor-pdf";
          return "vendor";
        }
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: staticTargets
    }),
    tsconfigPaths()
  ]
});
