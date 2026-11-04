import { decryptSecret, encryptSecret, randomToken, safeEqual } from './crypto.js';

describe('crypto', () => {
  it('cifra e decifra (AES-256-GCM) com IV aleatório', () => {
    const a = encryptSecret('APP_USR-123');
    const b = encryptSecret('APP_USR-123');
    expect(a).not.toBe(b);
    expect(a).not.toContain('APP_USR');
    expect(decryptSecret(a)).toBe('APP_USR-123');
  });

  it('rejeita conteúdo adulterado', () => {
    const parts = encryptSecret('segredo').split('.');
    parts[3] = Buffer.from('outro').toString('base64url');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });

  it('safeEqual e randomToken', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
