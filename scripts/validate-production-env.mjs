import process from 'node:process';
import { URL } from 'node:url';

const target = process.argv[2];

const requiredByTarget = {
  api: ['MONGODB_URI', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'WEB_ORIGIN'],
  web: ['NEXT_PUBLIC_API_ORIGIN'],
};

if (!(target in requiredByTarget)) {
  process.stderr.write('Usage: node scripts/validate-production-env.mjs <api|web>\n');
  process.exit(1);
}

const missing = requiredByTarget[target].filter((name) => !process.env[name]?.trim());

if (target === 'web' && process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false') {
  missing.push('NEXT_PUBLIC_USE_MOCK_API=false');
}

if (target === 'api' && process.env.ALLOW_PRIVATE_NETWORKS === 'true') {
  process.stderr.write('ALLOW_PRIVATE_NETWORKS must not be true in production.\n');
  process.exit(1);
}

if (missing.length > 0) {
  process.stderr.write(`Missing production configuration: ${missing.join(', ')}\n`);
  process.exit(1);
}

for (const name of target === 'api' ? ['MONGODB_URI', 'WEB_ORIGIN'] : ['NEXT_PUBLIC_API_ORIGIN']) {
  try {
    new URL(process.env[name]);
  } catch {
    process.stderr.write(`${name} must be a valid absolute URL.\n`);
    process.exit(1);
  }
}

process.stdout.write(`${target} production environment is configured.\n`);
