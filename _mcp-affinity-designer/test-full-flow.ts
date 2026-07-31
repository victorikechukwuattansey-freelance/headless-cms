import { AffinityDesignerMCPTools } from './src/tools/affinity-tools';

async function main() {
  const tools = new AffinityDesignerMCPTools();
  await tools.initialize();

  // Step 1: Start Affinity Designer
  console.log('Starting Affinity Designer...');
  const start = await tools.executeTool('affinity_start_app', {});
  console.log('  Start:', start.success, start.message);

  // Step 2: Create a new document (1080x1080 square post size)
  console.log('Creating new document...');
  const doc = await tools.executeTool('affinity_new_document', {
    width: 1080,
    height: 1080,
    units: 'px'
  });
  console.log('  Doc:', doc.success, doc.message);

  // Step 3: Add text
  console.log('Adding text...');
  const text = await tools.executeTool('affinity_add_text', {
    text: 'Restaurant Kit',
    fontSize: 36,
    x: 200,
    y: 200
  });
  console.log('  Text:', text.success, text.message);

  console.log('\nFull flow test complete! Affinity Designer should be open with a 1080x1080 document.');
}

main().catch(e => { console.error(e); process.exit(1); });
