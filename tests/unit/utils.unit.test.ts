import { describe, expect, test } from 'bun:test';
import { extract_api_key, extract_client_ip, remove_empty_top_level, validate_origin } from '../../src/lib/utils.ts';

describe('utils', () => {
  test('extract_api_key prefers x-firecrawl-api-key over others', () => {
    const headers = new Headers({
      'x-firecrawl-api-key': 'fc-primary',
      'x-api-key': 'fc-secondary',
      authorization: 'Bearer fc-auth'
    });

    expect(extract_api_key(headers)).toBe('fc-primary');
  });

  test('extract_api_key falls back to bearer token', () => {
    const headers = new Headers({ authorization: 'Bearer fc-auth' });
    expect(extract_api_key(headers)).toBe('fc-auth');
  });

  test('extract_client_ip reads first x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.5' });
    expect(extract_client_ip(headers)).toBe('203.0.113.9');
  });

  test('extract_client_ip falls back to unknown', () => {
    const headers = new Headers();
    expect(extract_client_ip(headers)).toBe('unknown');
  });

  describe('validate_origin', () => {
    test('permits all origins when no allowlist is configured', () => {
      const headers = new Headers({ origin: 'https://evil.com' });
      expect(validate_origin(headers, undefined)).toBe(true);
    });

    test('permits requests with no Origin header regardless of allowlist', () => {
      const headers = new Headers();
      expect(validate_origin(headers, ['https://good.com'])).toBe(true);
    });

    test('permits origin that matches an allowlist entry', () => {
      const headers = new Headers({ origin: 'https://good.com' });
      expect(validate_origin(headers, ['https://good.com'])).toBe(true);
    });

    test('blocks origin not in allowlist', () => {
      const headers = new Headers({ origin: 'https://evil.com' });
      expect(validate_origin(headers, ['https://good.com'])).toBe(false);
    });

    test('origin comparison is case-insensitive', () => {
      const headers = new Headers({ origin: 'HTTPS://GOOD.COM' });
      expect(validate_origin(headers, ['https://good.com'])).toBe(true);
    });

    test('permits origin matching any entry in a multi-entry allowlist', () => {
      const headers = new Headers({ origin: 'https://staging.example.com' });
      expect(validate_origin(headers, ['https://example.com', 'https://staging.example.com'])).toBe(true);
    });

    test('blocks origin when allowlist is populated and no entry matches', () => {
      const headers = new Headers({ origin: 'https://other.com' });
      expect(validate_origin(headers, ['https://example.com', 'https://staging.example.com'])).toBe(false);
    });
  });

  test('remove_empty_top_level drops empty values', () => {
    const input = {
      keep: 'value',
      blank: '   ',
      none: undefined,
      empty_arr: [] as string[],
      empty_obj: {},
      nested: { ok: true }
    };

    const out = remove_empty_top_level(input);

    expect(out).toEqual({ keep: 'value', nested: { ok: true } });
  });
});
