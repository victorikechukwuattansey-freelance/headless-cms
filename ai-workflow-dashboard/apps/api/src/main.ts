import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { loadEnv } from "@awd/config";
import { JsonLogger } from "@awd/logger";
import { NestLoggerAdapter } from "./nest-logger.adapter";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: new NestLoggerAdapter(new JsonLogger("awd-api")),
  });
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: env.WEB_URL ?? "*", credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(env.PORT ?? 4000);
  console.log(`[api] listening on http://localhost:${env.PORT ?? 4000}`);
}

void bootstrap();
