import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma does not auto-load .env when a config file is present, so load it
// explicitly. This makes DATABASE_URL available to `prisma db push`,
// `prisma migrate`, and `prisma generate`.
loadEnv({ path: path.join(__dirname, ".env") });

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
