import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile("backend/wrangler.jsonc", "utf8"));
const doubles = config.d1_databases?.find((db) => db.binding === "DB");
const singles = config.d1_databases?.find((db) => db.binding === "DB_SINGLES");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if (
  !uuid.test(doubles?.database_id || "") ||
  !uuid.test(singles?.database_id || "")
) {
  throw new Error("请配置 DB 和 DB_SINGLES 的实际 D1 database_id");
}
if (doubles.database_id.toLowerCase() === singles.database_id.toLowerCase()) {
  throw new Error("单打与双打必须绑定不同的 D1 数据库，禁止共用 database_id");
}
console.log("已验证单打和双打使用不同的 D1 数据库");
