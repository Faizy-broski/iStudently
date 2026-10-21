// Extends app.json. Native config can't read CSS, so colours used by the native splash and
// Android icon come from src/global.css here (the only place colour values are written).
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'src/global.css'), 'utf8').split('.dark:root')[0];
const token = (name, depth = 0) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`global.css has no --${name}`);
  const v = m[1].trim();
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref && depth < 8 ? token(ref[1], depth + 1) : v;
};

module.exports = ({ config }) => {
  const brand = token('brand');
  // EAS project id: written into app.json by `eas init` (or EAS_PROJECT_ID). Push tokens and OTA updates
  // (channels in eas.json) both need it; without it the app builds and runs, just without either.
  const projectId = config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID;
  return {
    ...config,
    ...(projectId
      ? {
          extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
          updates: { ...config.updates, url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 },
        }
      : {}),
    android: { ...config.android, adaptiveIcon: { ...config.android.adaptiveIcon, backgroundColor: brand } },
    plugins: config.plugins.map((p) =>
      // Native splash: plain brand colour; the animated splash (features/splash) takes over at once.
      Array.isArray(p) && p[0] === 'expo-splash-screen' ? ['expo-splash-screen', { backgroundColor: brand, image: './assets/images/splash-blank.png', imageWidth: 1 }] : p,
    ),
  };
};
