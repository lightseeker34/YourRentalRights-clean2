import { pool } from "../server/db";
import { upsertCommunityTopics } from "../server/forum-seed";

upsertCommunityTopics()
  .then((result) => {
    console.log(`✅ Seed complete: ${result.categories} categories processed, ${result.created} topics created, ${result.updated} topics updated.`);
  })
  .catch((error) => {
    console.error("❌ Failed to seed community starter topics:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
