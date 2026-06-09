#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mode = process.argv[2];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function findExecutable(name) {
  const candidates = [];

  if (process.platform === 'win32') {
    candidates.push({ cmd: 'where.exe', args: [name] });
  } else {
    candidates.push({ cmd: 'which', args: [name] });
  }

  // Common Windows install locations
  if (process.platform === 'win32') {
    const baseServer = 'C:/Program Files/MySQL/MySQL Server 8.0/bin';
    const baseWorkbench = 'C:/Program Files/MySQL/MySQL Workbench 8.0';
    candidates.push(
      { cmd: `${baseServer}/${name}.exe`, args: [] },
      { cmd: `${baseWorkbench}/${name}.exe`, args: [] }
    );
  }

  for (const candidate of candidates) {
    if (candidate.cmd.includes('/') || candidate.cmd.includes('\\')) {
      if (fs.existsSync(candidate.cmd)) {
        return candidate.cmd.replace(/\\/g, '/');
      }
      continue;
    }

    const result = spawnSync(candidate.cmd, candidate.args, { encoding: 'utf8', shell: false });
    if (result.status === 0) {
      const out = (result.stdout || '').trim();
      if (out) {
        const first = out.split(/\r?\n/).find(Boolean);
        return first.replace(/\\/g, '/');
      }
    }
  }

  return null;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
    shell: false,
    env: process.env
  });

  if (result.error) {
    fail(`Command failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`Command exited with code ${result.status}: ${command} ${args.join(' ')}`);
  }

  return result;
}

function getConfig(direction) {
  if (direction === 'aiven-to-local') {
    return {
      sourceHost: process.env.AIVEN_DB_HOST || process.env.DB_HOST || '',
      sourcePort: process.env.AIVEN_DB_PORT || process.env.DB_PORT || '3306',
      sourceUser: process.env.AIVEN_DB_USER || process.env.DB_USER || '',
      sourcePass: process.env.AIVEN_DB_PASSWORD || process.env.DB_PASSWORD || '',
      sourceDb: process.env.AIVEN_DB_NAME || process.env.DB_NAME || 'defaultdb',
      targetHost: process.env.LOCAL_DB_HOST || '127.0.0.1',
      targetPort: process.env.LOCAL_DB_PORT || '3306',
      targetUser: process.env.LOCAL_DB_USER || 'root',
      targetPass: process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || '',
      targetDb: process.env.LOCAL_DB_NAME || process.env.DB_NAME || 'footfield'
    };
  }

  return {
    sourceHost: process.env.LOCAL_DB_HOST || '127.0.0.1',
    sourcePort: process.env.LOCAL_DB_PORT || '3306',
    sourceUser: process.env.LOCAL_DB_USER || 'root',
    sourcePass: process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || '',
    sourceDb: process.env.LOCAL_DB_NAME || process.env.DB_NAME || 'footfield',
    targetHost: process.env.AIVEN_DB_HOST || process.env.DB_HOST || '',
    targetPort: process.env.AIVEN_DB_PORT || process.env.DB_PORT || '3306',
    targetUser: process.env.AIVEN_DB_USER || process.env.DB_USER || '',
    targetPass: process.env.AIVEN_DB_PASSWORD || process.env.DB_PASSWORD || '',
    targetDb: process.env.AIVEN_DB_NAME || process.env.DB_NAME || 'defaultdb'
  };
}

function buildMysqlArgs(host, port, user, pass, db, extra = []) {
  const args = ['-h', host, '-P', String(port), '-u', user];
  if (pass) args.push('-p' + pass);
  args.push(...extra, db);
  return args;
}

function buildDumpArgs(host, port, user, pass, db) {
  const args = ['-h', host, '-P', String(port), '-u', user, '-p' + pass, '--single-transaction', '--routines', '--triggers', '--set-gtid-purged=OFF'];
  const isRemoteHost = !['localhost', '127.0.0.1', '::1'].includes(String(host).toLowerCase());
  if (isRemoteHost) {
    args.push('--ssl-mode=REQUIRED');
  }
  args.push(db);
  return args;
}

if (!['aiven-to-local', 'local-to-aiven'].includes(mode)) {
  console.log('Usage: node scripts/sync-db.js aiven-to-local | local-to-aiven');
  process.exit(0);
}

const mysqlPath = findExecutable('mysql');
const mysqldumpPath = findExecutable('mysqldump');

if (!mysqlPath || !mysqldumpPath) {
  fail('Không tìm thấy mysql.exe / mysqldump.exe. Hãy cài MySQL Client hoặc thêm PATH đúng.');
}

const cfg = getConfig(mode);
console.log(`🔄 Sync mode: ${mode}`);
console.log(`   Source: ${cfg.sourceHost}:${cfg.sourcePort}/${cfg.sourceDb}`);
console.log(`   Target: ${cfg.targetHost}:${cfg.targetPort}/${cfg.targetDb}`);

if (mode === 'aiven-to-local') {
  if (!cfg.sourceHost || !cfg.sourceUser || !cfg.sourcePass) fail('Thiếu thông tin Aiven DB (AIVEN_DB_HOST / AIVEN_DB_USER / AIVEN_DB_PASSWORD).');
  if (!cfg.targetHost || !cfg.targetUser) fail('Thiếu thông tin local DB (LOCAL_DB_HOST / LOCAL_DB_USER).');

  runCommand(mysqlPath, buildMysqlArgs(cfg.targetHost, cfg.targetPort, cfg.targetUser, cfg.targetPass, cfg.targetDb, ['-e', `CREATE DATABASE IF NOT EXISTS ${cfg.targetDb};`]), { stdio: 'inherit' });

  const dump = runCommand(mysqldumpPath, buildDumpArgs(cfg.sourceHost, cfg.sourcePort, cfg.sourceUser, cfg.sourcePass, cfg.sourceDb), { stdio: 'pipe' });

  const importResult = spawnSync(mysqlPath, buildMysqlArgs(cfg.targetHost, cfg.targetPort, cfg.targetUser, cfg.targetPass, cfg.targetDb), {
    input: dump.stdout,
    encoding: 'utf8',
    shell: false,
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (importResult.error) fail(importResult.error.message);
  if (importResult.status !== 0) fail('Import dữ liệu vào local thất bại.');
  console.log('✅ Đồng bộ Aiven -> Local hoàn tất.');
} else {
  if (!cfg.sourceHost || !cfg.sourceUser) fail('Thiếu thông tin local DB (LOCAL_DB_HOST / LOCAL_DB_USER).');
  if (!cfg.targetHost || !cfg.targetUser || !cfg.targetPass) fail('Thiếu thông tin Aiven DB (AIVEN_DB_HOST / AIVEN_DB_USER / AIVEN_DB_PASSWORD).');

  const dump = runCommand(mysqldumpPath, buildDumpArgs(cfg.sourceHost, cfg.sourcePort, cfg.sourceUser, cfg.sourcePass, cfg.sourceDb), { stdio: 'pipe' });
  const importResult = spawnSync(mysqlPath, buildMysqlArgs(cfg.targetHost, cfg.targetPort, cfg.targetUser, cfg.targetPass, cfg.targetDb), {
    input: dump.stdout,
    encoding: 'utf8',
    shell: false,
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (importResult.error) fail(importResult.error.message);
  if (importResult.status !== 0) fail('Import dữ liệu lên Aiven thất bại.');
  console.log('✅ Đồng bộ Local -> Aiven hoàn tất.');
}
