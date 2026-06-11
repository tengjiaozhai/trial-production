import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {};
}

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  (globalThis as any).OffscreenCanvas = class OffscreenCanvas {
    constructor() {}
    getContext() { return null; }
  };
}

afterEach(() => {
  cleanup();
});
