/**
 * One-time script: rename store from zee-clothing / zee_clothing to Zee_Store.
 * - Finds tenant with tenant_name in [zee_clothing, zee-clothing, etc.]
 * - Copies that tenant's MongoDB database to the new name (zee_store)
 * - Updates auth tenants collection: tenant_name = "Zee_Store"
 *
 * Run from backend folder: node src/scripts/rename_tenant_to_zee_store.js
 * Ensure MONGO_URI and AUTH_DB_NAME are set (e.g. in .env).
 */
import "../loadEnv.js";
import { connectMongo, getTenantDbSlug } from "../db/mongo.js";
import { getAuthDb } from "../db/authDb.js";
import { config } from "../config.js";

const OLD_NAMES = ["zee_clothing", "zee-clothing", "Zee Clothing", "zee clothing"];
const NEW_TENANT_NAME = "Zee_Store";
const NEW_SLUG = getTenantDbSlug(NEW_TENANT_NAME); // "zee_store"
/** When auth is already Zee_Store but data still lives in old DB, use this as source. */
const FALLBACK_OLD_DB_SLUG = "zee_clothing";

const tenantDbPrefix = process.env.TENANT_DB_PREFIX ?? "";

async function copyCollection(client, fromDbName, toDbName, collectionName) {
  const fromDb = client.db(fromDbName);
  const toDb = client.db(toDbName);
  const coll = fromDb.collection(collectionName);
  const docs = await coll.find({}).toArray();
  if (docs.length === 0) {
    await toDb.createCollection(collectionName);
    return 0;
  }
  const toColl = toDb.collection(collectionName);
  await toColl.insertMany(docs);
  return docs.length;
}

async function main() {
  const client = await connectMongo();
  const authDb = await getAuthDb();
  const tenantsColl = authDb.collection("tenants");

  let tenant = await tenantsColl.findOne({
    tenant_name: { $in: OLD_NAMES },
  });
  let oldDbName;
  if (tenant) {
    const oldSlug = getTenantDbSlug(tenant.tenant_name);
    oldDbName = tenantDbPrefix ? tenantDbPrefix + oldSlug : oldSlug;
    console.log("Found tenant (by old name):", tenant.tenant_name, "-> slug:", oldSlug, "DB:", oldDbName);
  } else {
    tenant = await tenantsColl.findOne({ tenant_name: NEW_TENANT_NAME });
    if (!tenant) {
      console.log("No tenant found with name in:", OLD_NAMES, "or", NEW_TENANT_NAME);
      const all = await tenantsColl.find({}).project({ tenant_name: 1, email: 1 }).toArray();
      all.forEach((t) => console.log("  -", t.tenant_name, t.email));
      process.exit(1);
    }
    oldDbName = tenantDbPrefix ? tenantDbPrefix + FALLBACK_OLD_DB_SLUG : FALLBACK_OLD_DB_SLUG;
    console.log("Found tenant (already renamed):", tenant.tenant_name, "-> copying from DB:", oldDbName);
  }

  const newDbName = tenantDbPrefix ? tenantDbPrefix + NEW_SLUG : NEW_SLUG;
  console.log("Target tenant name:", NEW_TENANT_NAME, "-> slug:", NEW_SLUG, "DB:", newDbName);

  if (oldDbName === newDbName) {
    console.log("Source and target DB are the same, only ensuring tenant_name is", NEW_TENANT_NAME);
    await tenantsColl.updateOne(
      { _id: tenant._id },
      { $set: { tenant_name: NEW_TENANT_NAME } }
    );
    console.log("Done.");
    return;
  }

  const fromDb = client.db(oldDbName);
  const collections = await fromDb.listCollections().toArray();
  if (collections.length === 0) {
    console.log("Source DB has no collections. Nothing to copy.");
    process.exit(1);
  }
  console.log("Copying", collections.length, "collections from", oldDbName, "to", newDbName);

  for (const { name } of collections) {
    const count = await copyCollection(client, oldDbName, newDbName, name);
    console.log("  ", name, "->", count, "documents");
  }

  await tenantsColl.updateOne(
    { _id: tenant._id },
    { $set: { tenant_name: NEW_TENANT_NAME } }
  );
  console.log("Updated tenant_name to", NEW_TENANT_NAME);

  console.log("Done. You can drop the old database manually if desired: db.dropDatabase() on", oldDbName);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
