import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tokenIndex = require('./index.json');

export { tokenIndex };
export default tokenIndex;
