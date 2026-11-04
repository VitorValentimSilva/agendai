import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { env, SESSION_COOKIE } from './common/env.js';
import { originGuard, securityHeaders } from './common/security.js';

const SWAGGER_UI_VERSION = '5.29.0';

/** HTML do Swagger UI carregando CSS/JS por CDN — funciona em funções serverless (Vercel). */
function swaggerHtml(): string {
  const cdn = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agendaí API — Documentação</title>
  <link rel="stylesheet" href="${cdn}/swagger-ui.css" />
  <style>body{margin:0} .topbar{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${cdn}/swagger-ui-bundle.js" crossorigin></script>
  <script src="${cdn}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: new URL('openapi.json', window.location.href.replace(/\\/docs\\/?$/, '/')).toString(),
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
      withCredentials: true,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Agendaí API')
    .setDescription(
      'API do Agendaí — agendamento online white-label. Rotas públicas (cliente) e do painel (cookie httpOnly após /auth/login).',
    )
    .setVersion('1.0.0')
    .addCookieAuth(SESSION_COOKIE)
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

/** Configuração compartilhada entre o servidor e os testes e2e. */
export function configureApp(app: INestApplication): INestApplication {
  const http = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
    disable: (k: string) => void;
  };
  http.set('trust proxy', 1);
  http.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(cookieParser());
  app.use(originGuard);
  app.enableCors({ origin: env.webOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  const document = buildOpenApi(app);
  const adapter = app.getHttpAdapter();
  adapter.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(document);
  });
  adapter.get('/docs', (_req: Request, res: Response) => {
    res.type('html').send(swaggerHtml());
  });
  return app;
}
