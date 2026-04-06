#!/usr/bin/env node

/**
 * OpenAPI Consistency Checker
 *
 * Purpose: Detect if routes have changed but OpenAPI spec hasn't been regenerated.
 * This prevents the common risk: "route changed, but forgot to regenerate spec before commit"
 *
 * Usage: node scripts/openapi-diff-check.cjs --strict
 *        - --strict: Fail if spec appears out of date
 *        - (default): Warn only
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INDEX_FILE = path.resolve(process.cwd(), 'src/index.ts');
const OPENAPI_FILE = path.resolve(process.cwd(), 'openapi.json');
const OPENAPI_MANIFEST = path.resolve(process.cwd(), '.openapi.manifest.json');

// Check if files exist
if (!fs.existsSync(INDEX_FILE)) {
  console.error('ERROR: src/index.ts not found');
  process.exit(1);
}

if (!fs.existsSync(OPENAPI_FILE)) {
  console.warn('WARNING: openapi.json not generated yet. Run: npm run openapi:generate');
  process.exit(0);
}

// Read route source code
const routeSourceCode = fs.readFileSync(INDEX_FILE, 'utf8');
const routeHash = crypto.createHash('sha256').update(routeSourceCode).digest('hex');

// Check manifest
function loadManifest() {
  if (!fs.existsSync(OPENAPI_MANIFEST)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(OPENAPI_MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(OPENAPI_MANIFEST, JSON.stringify(manifest, null, 2));
}

const manifest = loadManifest();
const isStrict = process.argv.includes('--strict');

if (!manifest) {
  // First time - save baseline
  console.log('ℹ️  Creating OpenAPI consistency baseline...');
  saveManifest({
    routeHash,
    timestamp: new Date().toISOString(),
    version: '1.0'
  });
  console.log('✓ Baseline saved. Future runs will detect changes.');
  process.exit(0);
}

// Compare hashes
if (manifest.routeHash !== routeHash) {
  const message = 'OpenAPI spec appears OUT OF DATE (route code has changed).\nPossible cause: Routes modified but openapi.json not regenerated.\n\nFix: Run this before committing:\n  npm run openapi:generate';

  if (isStrict) {
    console.error('❌ STRICT MODE - Blocking commit');
    console.error(message);
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING');
    console.warn(message);
    process.exit(0);
  }
} else {
  console.log('✓ OpenAPI spec is consistent with routes');
  process.exit(0);
}
