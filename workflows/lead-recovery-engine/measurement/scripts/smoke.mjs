/** Scratch harness smoke check. Not part of the test suite. */
import { Engine } from '../src/engine.js';
import { newStore, engineOptions, WF, webhookInput, SECRET } from '../src/fixtures.js';

const store = newStore();
const eng = new Engine(WF.intake(), engineOptions(store));
eng.runAll(
  webhookInput({
    business_id: 'biz_lonestar_hvac',
    source_type: 'web_form',
    source_id: 'form-v42-001',
    name: 'John Carter',
    phone: '+1 (512) 555-0142',
    email: 'john.carter@example.com',
    message: 'I need an AC quote for my 3,000 sq ft home in Austin.',
    service: 'HVAC',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    urgency: 'normal'
  })
);

console.log('--- responses ---');
console.log(JSON.stringify(eng.responses, null, 2));
console.log('--- leads ---');
console.log(JSON.stringify(store.rows('leads'), null, 2));
console.log('--- outbox ---');
for (const e of eng.outbox) console.log(`${e.sent ? 'SENT ' : 'FAIL '} -> ${e.to} | ${e.subject}`);
console.log('--- errors ---');
console.log(JSON.stringify(store.rows('errors'), null, 2));
console.log('--- trace ---');
for (const t of eng.trace) console.log(`  ${t.node} [${t.type}] ${JSON.stringify(t)}`);
void SECRET;
