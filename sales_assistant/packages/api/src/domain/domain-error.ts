export type DomainErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'NO_AGENT_AVAILABLE'
  | 'VALIDATION'
  | 'RATE_LIMITED';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  NO_AGENT_AVAILABLE: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}