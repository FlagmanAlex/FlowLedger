// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Монорепо (npm workspaces) — shared/interfaces лежат вне mobile/, Metro
// должен видеть корень репозитория и общий node_modules.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// shared/interfaces — TS-исходники с ESM-style относительными импортами
// (`./foo.js`, указывающими на `foo.ts` — стиль moduleResolution: "Bundler").
// Vite/esbuild такие импорты понимают сами, а Metro — нет: он ищет буквально
// `foo.js` и не пытается подставить `.ts`/`.tsx`, если расширение уже задано
// явно. Подменяем резолвер: для относительных импортов с `.js`/`.jsx`
// сперва пробуем `.ts`/`.tsx`, и только если не нашлось — отдаём Metro
// исходный запрос как есть.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^\.{1,2}\//.test(moduleName) && /\.jsx?$/.test(moduleName)) {
    for (const ext of ['.ts', '.tsx']) {
      try {
        return (defaultResolveRequest ?? context.resolveRequest)(
          context,
          moduleName.replace(/\.jsx?$/, ext),
          platform,
        );
      } catch {
        // пробуем следующее расширение / откатываемся ниже
      }
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
