# 🧩 MongoCopy

[![CI](https://github.com/iamdhiraj69/Mongo-Copy/actions/workflows/ci.yml/badge.svg)](https://github.com/iamdhiraj69/Mongo-Copy/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/mongocopy.svg)](https://www.npmjs.com/package/mongocopy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MongoCopy** is a developer-friendly CLI tool to copy, export, import, or back up MongoDB collections and databases — safely, quickly, and locally — without complex MongoDB shell commands.

---

## 🚀 Features

- 🪄 **Simple CLI** — Copy databases or specific collections in one line  
- ⚡ **Fast batch copying** — Adjustable batch size for huge datasets  
- 🧰 **Dry-run mode** — Simulate copy before actually writing  
- 💾 **JSON Export/Import** — Backup or restore collections as JSON files  
- 🤖 **CI-ready** — Use `--yes` to skip confirmations in scripts  
- 📊 **Progress feedback** — Real-time progress bars with document counts  
- 🔄 **Incremental backups** — Copy only new/updated documents since last backup  
- 🔑 **Index copying** — Automatically copy indexes from source to target  
- ✅ **Schema validation** — Validate data compatibility before copying  
- 🚀 **Performance optimized** — Streaming and bulk operations for large datasets  
- 🧠 **Environment-based config** — Works out of the box via `.env`

---

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g mongocopy
```

### Local Project Installation

```bash
npm install mongocopy
```

### Development Installation

```bash
# Clone from GitHub
git clone https://github.com/iamdhiraj69/Mongo-Copy.git
cd MongoCopy
npm install

# Link globally for testing
npm link
```

### 2️⃣ Setup Environment

Copy `.env.example` → `.env` and update your MongoDB details:

```bash
SOURCE_DB_URI=mongodb+srv://username:password@source.mongodb.net
TARGET_DB_URI=mongodb+srv://username:password@target.mongodb.net
DB_NAME=my_database
```

## 🧠 Usage

### Copy All Collections
```bash
mongocopy --all
```

### Copy Specific Collections
```bash
mongocopy --collections users,posts
```

### Preview Without Writing (Dry Run)
```bash
mongocopy --all --dry-run
```

### Copy with Custom Batch Size
```bash
mongocopy --all --batch-size 500
```

### Skip Confirmation
```bash
mongocopy --all --yes
```

### Copy with Indexes
```bash
mongocopy --all --copy-indexes
```

### Incremental Backup (only new/updated documents)
```bash
# Copy documents updated in the last 7 days
mongocopy --all --incremental --timestamp-field updatedAt --since 2024-01-01T00:00:00Z
```

### Validate Schema Before Copy
```bash
mongocopy --all --validate-schema
```

### Disable Progress Bars
```bash
mongocopy --all --no-progress
```

## 💾 Backup / Restore JSON

### Export Collections to JSON
```bash
mongocopy --all --export-json
```
All files will be saved to the `backup/` folder (auto-created).

### Import JSON Back into MongoDB
```bash
mongocopy --import-json
```

You can change the backup directory using:
```bash
mongocopy --export-json --output-dir ./my_backup
```

## ⚙️ Environment Variables

| Key | Description | Default |
|-----|-------------|---------|
| SOURCE_DB_URI | MongoDB source URI | Required |
| TARGET_DB_URI | MongoDB target URI | Required |
| DB_NAME | Database name | Required |
| BATCH_SIZE | Documents per insert batch | 1000 |
| LOG_TO_FILE | Write logs to file (true/false) | false |
| LOG_PATH | Log file path (if enabled) | ./mongocopy.log |
| BACKUP_DIR | JSON export/import folder | ./backup |

## 🥇 CLI Examples

### Basic Copy
```bash
mongocopy --collections users,posts --batch-size 2000 --yes
```
Copies only users and posts collections using batch size 2000 without confirmation.

### Full Backup with Indexes
```bash
mongocopy --all --copy-indexes --export-json --output-dir ./full-backup
```
Exports all collections and their indexes to JSON files.

### Incremental Sync
```bash
mongocopy --all --incremental --timestamp-field updatedAt --since 2024-01-01T00:00:00Z
```
Copies only documents updated since January 1, 2024.

### Safe Production Copy
```bash
mongocopy --all --validate-schema --copy-indexes --batch-size 5000
```
Validates schema compatibility and copies with indexes using larger batches.

## 💻 Programmatic API Usage

Use MongoCopy in your Node.js applications:

```javascript
import { copyCollections } from 'mongocopy';

// Copy specific collections
const results = await copyCollections({
  sourceUri: 'mongodb://localhost:27017',
  targetUri: 'mongodb://localhost:27018',
  dbName: 'myDatabase',
  collections: ['users', 'posts'],
  batchSize: 1000,
  dryRun: false,
  showProgress: true
});

console.log(results);
// [
//   { name: 'users', copied: 1500, total: 1500, status: 'copied' },
//   { name: 'posts', copied: 3200, total: 3200, status: 'copied' }
// ]

// Export to JSON with indexes
const exportResults = await copyCollections({
  sourceUri: 'mongodb://localhost:27017',
  targetUri: 'mongodb://localhost:27017',
  dbName: 'myDatabase',
  collections: ['users'],
  exportJson: true,
  outputDir: './backup',
  copyIndexes: true
});

// Incremental backup (only documents updated since a date)
const incrementalResults = await copyCollections({
  sourceUri: 'mongodb://localhost:27017',
  targetUri: 'mongodb://localhost:27018',
  dbName: 'myDatabase',
  collections: ['users'],
  incremental: true,
  timestampField: 'updatedAt',
  since: new Date('2024-01-01'),
  showProgress: true
});

// Copy with schema validation
const validatedResults = await copyCollections({
  sourceUri: 'mongodb://localhost:27017',
  targetUri: 'mongodb://localhost:27018',
  dbName: 'myDatabase',
  collections: ['users'],
  validateSchema: true,
  copyIndexes: true
});
```

## 🧰 Development

```bash
npm install
npm run start
```

## 🪄 NPM CLI Setup (optional)

To use it as a global CLI after publishing, add this to package.json:

```json
{
  "bin": {
    "mongocopy": "./src/index.js"
  }
}
```

Then install globally:
```bash
npm i -g .
mongocopy --help
```

## 🧩 Roadmap

| Status | Enhancement | Description |
|--------|------------|-------------|
| ✅ | --dry-run | Simulate copy without writing |
| ✅ | --collections | Copy specific collections |
| ✅ | JSON export/import | Backup & restore to local JSON |
| ✅ | --yes flag | Skip confirmation for CI |
| ✅ | Progress bars | Real-time visual feedback with document counts |
| ✅ | Index copying | Copy indexes from source to target |
| ✅ | Incremental backups | Copy only new/updated documents |
| ✅ | Schema validation | Validate before copying |
| ✅ | Performance optimizations | Streaming and bulk operations |
| ✅ | Enhanced test coverage | Comprehensive test cases |
| 🧠 | File logging | Save logs for debugging |
| 🧩 | TypeScript version | Optional future version |

## 🧑‍💻 Author

Dhiraj  
📦 GitHub: [iamdhiraj69](https://github.com/iamdhiraj69)
