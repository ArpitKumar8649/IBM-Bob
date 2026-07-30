import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma does not auto-load env files when a config file is present, so load
// them explicitly. `.env.local` comes first because that is where Next.js keeps
// a developer's real values and dotenv does not overwrite an already-set key —
// loading `.env` first would pin a shared placeholder and every `prisma db push`
// would quietly target the wrong database. An env var already exported in the
// shell still wins over both.
for (const file of [".env.local", ".env"]) {
  loadEnv({ path: path.join(__dirname, file) });
}

/**
 * Prisma 7 configuration — connection URL lives here (not in the schema).
 */
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://user:password@localhost:5432/writers_room",
  },
});
