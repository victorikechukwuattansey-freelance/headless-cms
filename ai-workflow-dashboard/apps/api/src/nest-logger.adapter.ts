import { Injectable, LoggerService } from "@nestjs/common";
import { JsonLogger } from "@awd/logger";

@Injectable()
export class NestLoggerAdapter implements LoggerService {
  constructor(private readonly logger: JsonLogger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info(String(message), this.context(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(String(message), this.context(optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(String(message), this.context(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(String(message), this.context(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(String(message), this.context(optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.fatal(String(message), this.context(optionalParams));
  }

  private context(optionalParams: unknown[]): Record<string, unknown> | undefined {
    if (optionalParams.length === 0) return undefined;
    return { context: optionalParams.map(String).join(" ") };
  }
}
