import { connect } from '../src/database/connection.mjs';
import { fileURLToPath } from 'node:url';
const db = connect();
try {
  const [, names] = await db.migrate.latest({
    directory: fileURLToPath(new URL('../migrations', import.meta.url)),
    loadExtensions: ['.cjs'],
  });
  console.log('Applied migrations:', names);
} catch (error) {
  console.error(
    'Migration failed:',
    error.code ?? error.name,
    error.message?.replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/g, '[redacted]'),
  );
  process.exitCode = 1;
} finally {
  await db.destroy();
}
