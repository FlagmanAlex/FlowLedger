import { copyFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Сборка сервера в один файл dist/index.js со всеми зависимостями внутри —
// на VPS не нужен ни node_modules, ни npm install: rsync одного файла и рестарт.
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // Опциональные нативные зависимости драйвера mongodb — у нас не используются
  // (нет Kerberos/шифрования полей/сжатия snappy/zstd).
  external: [
    'kerberos',
    '@mongodb-js/zstd',
    '@aws-sdk/credential-providers',
    'gcp-metadata',
    'snappy',
    'socks',
    'aws4',
    'mongodb-client-encryption',
  ],
  // Часть зависимостей (pino и др.) — CommonJS и вызывает require(); в ESM-бандле
  // require нужно создать явно.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

// Бандл — ESM: без package.json с "type": "module" рядом Node на VPS прочитал бы
// index.js как CommonJS. Конфиг pm2 едет в том же каталоге.
await writeFile('dist/package.json', '{ "type": "module" }\n');
await copyFile('deploy/ecosystem.config.cjs', 'dist/ecosystem.config.cjs');
