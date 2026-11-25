// Optional isolated copy of the normal candidate reader build.
import { cp, rm } from 'node:fs/promises';

const output = new URL('../../build/context-reader/', import.meta.url);
await rm(output, { recursive: true, force: true });
await cp(new URL('../../dist/', import.meta.url), output, { recursive: true });
console.log(output.pathname);
