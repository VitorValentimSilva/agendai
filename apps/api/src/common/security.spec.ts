import { isAllowedOrigin } from './security.js';

describe('isAllowedOrigin', () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  it('aceita o WEB_ORIGIN e o próprio host da API', () => {
    process.env.WEB_ORIGIN = 'https://agendai-web.vercel.app';
    expect(isAllowedOrigin('https://agendai-web.vercel.app', 'api.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://api.vercel.app', 'api.vercel.app')).toBe(true);
  });

  it('aceita subdomínios do ROOT_DOMAIN só via https', () => {
    process.env.ROOT_DOMAIN = 'agendai.com.br';
    process.env.NODE_ENV = 'production';
    expect(isAllowedOrigin('https://navalha.agendai.com.br', 'x')).toBe(true);
    expect(isAllowedOrigin('http://navalha.agendai.com.br', 'x')).toBe(false);
    expect(isAllowedOrigin('https://agendai.com.br.evil.com', 'x')).toBe(false);
  });

  it('recusa origens desconhecidas e valores inválidos', () => {
    process.env.NODE_ENV = 'production';
    process.env.WEB_ORIGIN = 'https://agendai-web.vercel.app';
    expect(isAllowedOrigin('https://evil.com', 'api.vercel.app')).toBe(false);
    expect(isAllowedOrigin('null', 'api.vercel.app')).toBe(false);
    expect(isAllowedOrigin('http://localhost:3000', 'api.vercel.app')).toBe(false);
  });
});
