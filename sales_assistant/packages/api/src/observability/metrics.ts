const lines: string[] = [];

export function recordHttpRequest(path: string, statusCode: number, durationMs: number): void {
  lines.push(`http_requests_total{path="${path}",status="${statusCode}"} 1`);
  lines.push(`http_request_duration_ms{path="${path}"} ${durationMs}`);
}

export function recordQueueJob(jobType: string, succeeded: boolean): void {
  lines.push(`queue_jobs_total{type="${jobType}",succeeded="${succeeded}"} 1`);
}

export function recordQueueDepth(depth: number): void {
  lines.push(`queue_depth ${depth}`);
}

export function recordQueueJobDuration(jobType: string, durationMs: number): void {
  lines.push(`queue_job_duration_ms{type="${jobType}"} ${durationMs}`);
}

export function recordAiUsage(organizationId: string, model: string, tokensIn: number, tokensOut: number): void {
  lines.push(`ai_usage_tokens_total{organization="${organizationId}",model="${model}"} ${tokensIn + tokensOut}`);
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