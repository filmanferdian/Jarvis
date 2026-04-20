// Single source of truth: reads from package.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json');

export const VERSION = {
  // Full semver from package.json. Use for logs, API headers, server health.
  get string() {
    return pkg.version as string;
  },
  // User-facing label: major.minor only. Use for any UI surface.
  get display() {
    return (pkg.version as string).split('.').slice(0, 2).join('.');
  },
};
