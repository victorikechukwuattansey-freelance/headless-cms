const MAX_LINES = 5_000;
const lines: string[] = [];

function push(line: string): void {
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
  }
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function recordHttpRequest(path: string, statusCode: number, durationMs: number): void {
  push(`http_requests_total{path="${escapeLabel(path)}",status="${statusCode}"} 1`);
  push(`http_request_duration_ms{path="${escapeLabel(path)}"} ${durationMs}`);
}

export function recordQueueJob(jobType: string, succeeded: boolean): void {
  push(`queue_jobs_total{type="${escapeLabel(jobType)}",succeeded="${succeeded}"} 1`);
}

export function recordQueueDepth(depth: number): void {
  push(`queue_depth ${depth}`);
}

export function recordQueueJobDuration(jobType: string, durationMs: number): void {
  push(`queue_job_duration_ms{type="${escapeLabel(jobType)}"} ${durationMs}`);
}

export function recordAiUsage(organizationId: string, model: string, tokensIn: number, tokensOut: number): void {
  push(`ai_usage_tokens_total{organization="${escapeLabel(organizationId)}",model="${escapeLabel(model)}"} ${tokensIn + tokensOut}`);
}

export function renderPrometheusMetrics(): string {
  const headers = [
    '# HELP http_requests_total Total HTTP requests',
    '# TYPE http_requests_total counter',
    '# HELP queue_jobs_total Total queue jobs processed',
    '# TYPE queue_jobs_total counter',
    '# HELP queue_depth Current queue depth',
    '# TYPE queue_depth gauge',
    '# HELP queue_job_duration_ms Queue job processing time',
    '# TYPE queue_job_duration_ms histogram',
    '# HELP ai_usage_tokens_total Total AI tokens consumed',
    '# TYPE ai_usage_tokens_total counter',
  ];
  return `${headers.join('\n')}\n${lines.join('\n')}\n`;
}
