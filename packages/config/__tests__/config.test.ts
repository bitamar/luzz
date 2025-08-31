import { describe, it, expect } from 'vitest';
import { loadServerConfigFromEnv } from '../src';

describe('loadServerConfigFromEnv', () => {
  it('returns API_BASE_URL and ENV when provided', () => {
    const cfg = loadServerConfigFromEnv({ API_BASE_URL: 'http://api', NODE_ENV: 'test' } as any);
    expect(cfg).toEqual({ API_BASE_URL: 'http://api', ENV: 'test' });
  });

  it('omits ENV when NODE_ENV not set', () => {
    const cfg = loadServerConfigFromEnv({ API_BASE_URL: 'http://api' } as any);
    expect(cfg).toEqual({ API_BASE_URL: 'http://api' });
    expect('ENV' in cfg).toBe(false);
  });
});
