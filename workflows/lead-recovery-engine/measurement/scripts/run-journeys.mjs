/** Run the nine journeys and print what the engine actually did. Diagnostic tool. */
import { ALL_JOURNEYS } from '../src/journeys.js';

for (const fn of ALL_JOURNEYS) {
  const j = fn();
  console.log(`\n${'='.repeat(78)}\nJOURNEY ${j.id}: ${j.name}\n${'='.repeat(78)}`);
  for (const [k, v] of Object.entries(j)) {
    if (k === 'store' || k === 'id' || k === 'name' || k === 'sheetsDown') continue;
    console.log(`  ${k}: ${JSON.stringify(v, null, 2).split('\n').join('\n  ')}`);
  }
}
