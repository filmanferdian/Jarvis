// Single source of truth: reads from package.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json');

export const VERSION = {
  get string() {
    return pkg.version as string;
  },
};
