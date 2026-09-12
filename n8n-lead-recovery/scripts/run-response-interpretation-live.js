'use strict';

/* CLI entry for the Response Interpretation V1 Phase 5 live runner.
 * All logic lives in src/response-interpretation-live-runner.js; this file
 * only forwards argv/env and translates the result into an exit code.
 */

const { main } = require('../src/response-interpretation-live-runner');

main(process.argv.slice(2), process.env)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`[run-response-interpretation-live] ${err && err.stack ? err.stack : err}`);
    process.exitCode = 2;
  });