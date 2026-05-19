/** Runs before test files so DB-gated suites see `dbAvailable`. */
import { initDbAvailability } from './setup';

await initDbAvailability();
