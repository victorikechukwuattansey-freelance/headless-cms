export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface LogContext {
  service?: string;
  environment?: string;
  correlationId?: string;
  requestId?: string;
  organizationId?: string;
  userId?: string;
  workflowId?: string;
  executionId?: string;
  [key: string]: unknown;
}

export interface Logger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

export class JsonLogger implements Logger {
  private readonly minimumLevel: LogLevel;
  private readonly baseContext: LogContext;

  constructor(service: string, options: { environment?: string; minimumLevel?: LogLevel } = {}) {
    this.minimumLevel = options.minimumLevel ?? "INFO";
    this.baseContext = {
      service,
      environment: options.environment ?? process.env.NODE_ENV ?? "development",
    };
  }

  child(bindings: LogContext): Logger {
    return new ChildLogger(this, bindings);
  }

  trace(message: string, context?: LogContext): void {
    this.write("TRACE", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.write("DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write("INFO", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write("WARN", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write("ERROR", message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.write("FATAL", message, context);
  }

  write(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minimumLevel]) {
      return;
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.baseContext,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === "ERROR" || level === "FATAL" || level === "WARN") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }
}

class ChildLogger implements Logger {
  constructor(
    private readonly parent: JsonLogger,
    private readonly bindings: LogContext,
  ) {}

  child(extra: LogContext): Logger {
    return new ChildLogger(this.parent, { ...this.bindings, ...extra });
  }

  trace(message: string, context?: LogContext): void {
    this.parent.trace(message, { ...this.bindings, ...context });
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.bindings, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.bindings, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.bindings, ...context });
  }

  error(message: string, context?: LogContext): void {
    this.parent.error(message, { ...this.bindings, ...context });
  }

  fatal(message: string, context?: LogContext): void {
    this.parent.fatal(message, { ...this.bindings, ...context });
  }
}
