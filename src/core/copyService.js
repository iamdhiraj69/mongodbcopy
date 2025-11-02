import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import cliProgress from "cli-progress";
import env from "../utils/config/env.js";
import logger from "../utils/logger.js";

/**
 * Copies collections between MongoDB databases with support for JSON export/import.
 *
 * @param {Object} options - Configuration options for the copy operation
 * @param {string} [options.sourceUri] - MongoDB connection URI for source database
 * @param {string} [options.targetUri] - MongoDB connection URI for target database
 * @param {string} [options.dbName] - Name of the database to operate on
 * @param {string[]} [options.collections=[]] - Array of collection names to copy (empty = all collections)
 * @param {boolean} [options.dryRun=false] - If true, simulates the operation without writing data
 * @param {number} [options.batchSize=1000] - Number of documents to process in each batch
 * @param {boolean} [options.exportJson=false] - If true, exports collections to JSON files
 * @param {boolean} [options.importJson=false] - If true, imports collections from JSON files
 * @param {string} [options.outputDir='./backup'] - Directory for JSON export/import files
 * @param {boolean} [options.showProgress=true] - If true, displays progress bars during operations
 * @param {boolean} [options.copyIndexes=false] - If true, copies indexes from source to target
 * @param {boolean} [options.validateSchema=false] - If true, validates schema before copying
 * @param {boolean} [options.incremental=false] - If true, performs incremental backup based on timestamp
 * @param {string} [options.timestampField='_updatedAt'] - Field to use for incremental backup
 * @param {Date} [options.since] - Date for incremental backup (only copy docs updated since this date)
 * @returns {Promise<Array<{name: string, copied: number, total: number, status: string}>>}
 *          Array of results for each collection processed
 * @throws {Error} If connection fails or operation encounters an error
 *
 * @example
 * // Copy all collections with progress bar
 * const results = await copyCollections({
 *   collections: [],
 *   dryRun: false,
 *   showProgress: true
 * });
 *
 * @example
 * // Export specific collections to JSON with indexes
 * const results = await copyCollections({
 *   collections: ['users', 'posts'],
 *   exportJson: true,
 *   outputDir: './backup',
 *   copyIndexes: true
 * });
 *
 * @example
 * // Incremental backup since last week
 * const results = await copyCollections({
 *   collections: ['users'],
 *   incremental: true,
 *   since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 *   timestampField: 'updatedAt'
 * });
 */
export async function copyCollections({
  sourceUri = env.SOURCE_DB_URI,
  targetUri = env.TARGET_DB_URI,
  dbName = env.DB_NAME,
  collections = [],
  dryRun = false,
  batchSize = env.BATCH_SIZE || 1000,
  exportJson = false,
  importJson = false,
  outputDir = "./backup",
  showProgress = true,
  copyIndexes = false,
  validateSchema = false,
  incremental = false,
  timestampField = "_updatedAt",
  since = null,
} = {}) {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  await sourceClient.connect();
  await targetClient.connect();
  const sourceDb = sourceClient.db(dbName);
  const targetDb = targetClient.db(dbName);
  
  // Initialize progress bar
  let progressBar = null;
  if (showProgress) {
    progressBar = new cliProgress.SingleBar({
      format: "Progress |{bar}| {percentage}% | {value}/{total} documents | {collection}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true
    });
  }
  
  try {
    const found = await sourceDb.listCollections().toArray();
    const allNames = found.map((c) => c.name);
    if (!collections || collections.length === 0) collections = allNames;
    else collections = collections.filter((c) => allNames.includes(c));
    const summary = [];
    if (exportJson && !fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    for (const name of collections) {
      const col = sourceDb.collection(name);
      
      // Build query for incremental backup
      let query = {};
      if (incremental && since) {
        query[timestampField] = { $gte: since };
      }
      
      const total = await col.countDocuments(query);
      if (total === 0) {
        summary.push({ name, copied: 0, total, status: incremental ? "no-new-docs" : "empty" });
        continue;
      }
      
      // Schema validation
      if (validateSchema && !dryRun && !exportJson) {
        try {
          const sampleDoc = await col.findOne(query);
          if (sampleDoc) {
            const destCol = targetDb.collection(name);
            // Try to validate by attempting a single insert in a test
            const validationResult = await destCol.insertOne({ ...sampleDoc, _validationTest: true });
            if (validationResult.acknowledged) {
              await destCol.deleteOne({ _id: validationResult.insertedId });
            }
          }
        } catch (err) {
          summary.push({ name, copied: 0, total, status: "schema-validation-failed", error: err.message });
          continue;
        }
      }
      
      if (dryRun) {
        summary.push({ name, copied: 0, total, status: "dry-run" });
        continue;
      }
      
      // Initialize progress bar for this collection
      if (progressBar && total > 0) {
        progressBar.start(total, 0, { collection: name });
      }
      if (importJson) {
        const filePath = path.join(outputDir, `${name}.json`);
        if (!fs.existsSync(filePath)) {
          if (progressBar) progressBar.stop();
          summary.push({ name, copied: 0, total: 0, status: "no-json-file" });
          continue;
        }
        const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (json.length === 0) {
          if (progressBar) progressBar.stop();
          summary.push({ name, copied: 0, total: 0, status: "json-empty" });
          continue;
        }
        const destCol = targetDb.collection(name);
        
        // For incremental import, don't delete all, use upserts instead
        if (incremental) {
          for (let i = 0; i < json.length; i += batchSize) {
            const chunk = json.slice(i, i + batchSize);
            const bulkOps = chunk.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            await destCol.bulkWrite(bulkOps, { ordered: false });
            if (progressBar) progressBar.update(i + chunk.length);
          }
        } else {
          await destCol.deleteMany({});
          for (let i = 0; i < json.length; i += batchSize) {
            const chunk = json.slice(i, i + batchSize);
            await destCol.insertMany(chunk, { ordered: false });
            if (progressBar) progressBar.update(i + chunk.length);
          }
        }
        
        // Copy indexes if requested
        if (copyIndexes) {
          const indexFilePath = path.join(outputDir, `${name}_indexes.json`);
          if (fs.existsSync(indexFilePath)) {
            const indexes = JSON.parse(fs.readFileSync(indexFilePath, "utf8"));
            await copyIndexesToTarget(destCol, indexes);
          }
        }
        
        if (progressBar) progressBar.stop();
        summary.push({ name, copied: json.length, total: json.length, status: "imported-json" });
        continue;
      }
      if (exportJson) {
        const cursor = col.find(query);
        const filePath = path.join(outputDir, `${name}.json`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const allDocs = [];
        let docCount = 0;
        while (await cursor.hasNext()) {
          allDocs.push(await cursor.next());
          docCount++;
          if (progressBar) progressBar.update(docCount);
        }
        fs.writeFileSync(filePath, JSON.stringify(allDocs, null, 2), "utf8");
        
        // Export indexes if requested
        if (copyIndexes) {
          const indexes = await col.indexes();
          const indexFilePath = path.join(outputDir, `${name}_indexes.json`);
          fs.writeFileSync(indexFilePath, JSON.stringify(indexes, null, 2), "utf8");
        }
        
        if (progressBar) progressBar.stop();
        summary.push({ name, copied: allDocs.length, total, status: "exported-json" });
        continue;
      }
      const destCol = targetDb.collection(name);
      
      // For incremental, use upserts instead of delete all
      const cursor = col.find(query);
      let copied = 0;
      
      if (incremental) {
        // Use streaming with bulkWrite for better performance
        const batch = [];
        while (await cursor.hasNext()) {
          batch.push(await cursor.next());
          
          if (batch.length >= batchSize) {
            const bulkOps = batch.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            await destCol.bulkWrite(bulkOps, { ordered: false });
            copied += batch.length;
            if (progressBar) progressBar.update(copied);
            batch.length = 0; // Clear batch
          }
        }
        
        // Process remaining documents
        if (batch.length > 0) {
          const bulkOps = batch.map(doc => ({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true
            }
          }));
          await destCol.bulkWrite(bulkOps, { ordered: false });
          copied += batch.length;
          if (progressBar) progressBar.update(copied);
        }
      } else {
        // Full copy: delete all and insert
        await destCol.deleteMany({});
        
        while (await cursor.hasNext()) {
          const batch = [];
          for (let i = 0; i < batchSize && (await cursor.hasNext()); i++) {
            batch.push(await cursor.next());
          }
          if (batch.length) {
            await destCol.insertMany(batch, { ordered: false });
            copied += batch.length;
            if (progressBar) progressBar.update(copied);
          }
        }
      }
      
      // Copy indexes after data
      if (copyIndexes) {
        const indexes = await col.indexes();
        await copyIndexesToTarget(destCol, indexes);
      }
      
      if (progressBar) progressBar.stop();
      summary.push({ name, copied, total, status: incremental ? "incremental-copied" : "copied" });
    }
    return summary;
  } finally {
    if (progressBar) progressBar.stop();
    await sourceClient.close();
    await targetClient.close();
  }
}

/**
 * Helper function to copy indexes from source to target collection
 * @param {Collection} targetCol - Target MongoDB collection
 * @param {Array} indexes - Array of index definitions from source
 */
async function copyIndexesToTarget(targetCol, indexes) {
  // Filter out the default _id index and create others
  const indexesToCreate = indexes.filter(idx => idx.name !== "_id_");
  
  for (const index of indexesToCreate) {
    try {
      const { key, name, ...options } = index;
      // Remove internal fields that shouldn't be passed to createIndex
      delete options.v;
      delete options.ns;
      
      await targetCol.createIndex(key, { ...options, name });
    } catch (err) {
      // Index might already exist or have conflicts, log but continue
      logger.warn(`Could not create index ${index.name}: ${err.message}`);
    }
  }
}

export default copyCollections;
