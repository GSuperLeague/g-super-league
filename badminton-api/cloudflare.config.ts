import { bindings, defineConfig } from "cf/config";

// Badminton and gallery writes use their own tables. The table-football Worker
// remains the authority for its own data and for administrator authentication.
export default defineConfig({
  accountId:
    process.env.CLOUDFLARE_ACCOUNT_ID || "538b5352ee8d9241782bf83815ff9265",
  worker: {
    name: "gair-badminton-api",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-11-04",
    workersDev: true,
    observability: {
      enabled: true,
      logs: { enabled: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.01 },
      redactQueryString: true,
    },
    env: {
      DB: bindings.d1({
        id:
          process.env.GB_DATABASE_ID || "8f6cd918-332f-4da2-a581-0c799becc909",
        name: "g-super-league",
      }),
      AUTH_SERVICE: bindings.worker({ worker: "g-super-league-api" }),
      ALLOWED_ORIGINS: bindings.text(
        "https://gsuperleague.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
      ),
    },
  },
});
