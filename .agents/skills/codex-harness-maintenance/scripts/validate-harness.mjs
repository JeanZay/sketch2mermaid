import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_AGENTS_BYTES = 32 * 1024;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(SCRIPT_DIR, '../../../..');
const rootAgentsPath = join(repoRoot, 'AGENTS.md');
const legacyAgentsPath = join(repoRoot, '.agents', 'AGENTS.md');
const skillsRoot = join(repoRoot, '.agents', 'skills');
const errors = [];

function fail(message) {
  errors.push(message);
}

function readRequired(path, label) {
  if (!existsSync(path)) {
    fail(`${label} is missing: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function parseFrontMatter(content, skillName) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    fail(`${skillName}: missing or malformed YAML front matter`);
    return null;
  }

  const values = new Map();
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const field = rawLine.match(/^([a-z][a-z0-9_-]*):\s*(.+)$/);
    if (!field) {
      fail(`${skillName}: front matter fields must be non-empty single-line values`);
      continue;
    }
    const [, key, rawValue] = field;
    if (!['name', 'description'].includes(key)) {
      fail(`${skillName}: unsupported front matter field "${key}"`);
      continue;
    }
    if (values.has(key)) fail(`${skillName}: duplicate front matter field "${key}"`);
    const value = rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2').trim();
    values.set(key, value);
  }

  for (const key of ['name', 'description']) {
    if (!values.get(key)) fail(`${skillName}: required front matter field "${key}" is missing`);
  }
  return values;
}

function checkPortableMarkdown(content, label) {
  if (/file:\/\//i.test(content)) fail(`${label}: file:// links are not portable`);
  if (/[A-Za-z]:[\\/]/.test(content)) fail(`${label}: absolute Windows paths are not portable`);
}

const rootAgents = readRequired(rootAgentsPath, 'Root AGENTS.md');
if (rootAgents) {
  const size = statSync(rootAgentsPath).size;
  if (size > MAX_AGENTS_BYTES) {
    fail(`Root AGENTS.md is ${size} bytes; maximum is ${MAX_AGENTS_BYTES}`);
  }
  checkPortableMarkdown(rootAgents, 'AGENTS.md');
}

if (existsSync(legacyAgentsPath)) {
  fail('Legacy .agents/AGENTS.md must be removed; repository guidance belongs at the root');
}

if (!existsSync(skillsRoot)) {
  fail(`Skills directory is missing: ${skillsRoot}`);
} else {
  const skillNames = readdirSync(skillsRoot)
    .filter((entry) => statSync(join(skillsRoot, entry)).isDirectory())
    .sort();
  const declaredNames = new Set();

  if (skillNames.length === 0) fail('No repository skills were found');

  for (const skillName of skillNames) {
    const skillPath = join(skillsRoot, skillName, 'SKILL.md');
    const content = readRequired(skillPath, `${skillName}/SKILL.md`);
    if (!content) continue;

    checkPortableMarkdown(content, `${skillName}/SKILL.md`);
    const frontMatter = parseFrontMatter(content, skillName);
    if (!frontMatter) continue;

    const declaredName = frontMatter.get('name');
    if (declaredName !== skillName) {
      fail(`${skillName}: front matter name must match the folder, found "${declaredName}"`);
    }
    if (!/^[a-z0-9-]{1,63}$/.test(declaredName ?? '')) {
      fail(`${skillName}: name must use lowercase letters, digits, and hyphens only`);
    }
    if (declaredNames.has(declaredName)) fail(`${skillName}: duplicate declared skill name`);
    declaredNames.add(declaredName);

    if (!rootAgents.includes(`\`${skillName}\``)) {
      fail(`${skillName}: root AGENTS.md does not reference this skill`);
    }
  }
}

if (errors.length > 0) {
  console.error('Codex harness validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Codex harness validation passed.');
