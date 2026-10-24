import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// Whole-app tests render the full route tree; give async queries room when the machine is busy
// (the suite runs many files in parallel). Slow but correct is not a failure.
configure({ asyncUtilTimeout: 5000 });
