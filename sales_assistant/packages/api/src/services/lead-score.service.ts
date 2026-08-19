import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { createAiProvider, type AiProvider } from '../ai/provider.js';
import { writeAuditEvent } from './audit.service.js';

export interface ScoreResult {
  score: number;
  reason: string;
}

const SCORE_MODEL = 'gpt-4o-mini';

const STATUS_BASE_SCORE: Record<string, number> = {
  new: 40,
  assigned: 55,
  contacted: 65,
  qualified: 80,
  converted: 90,
  lost: 10,
};

function parseScoreJson(content: string): ScoreResult | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { score?: unknown; reason?: unknown };
    if (typeof parsed.score !== 'number' || typeof parsed.reason !== 'string') return null;
    return { score: Math.round(Math.min(100, Math.max(0, parsed.score))), reason: parsed.reason.slice(0, 200) };
  } catch {
    return null;
  }
}

function fallbackScore(lead: { status: string; score: number; name: string | null }): ScoreResult {
  const base = STATUS_BASE_SCORE[lead.status] ?? 40;
  const score = Math.min(100, Math.max(0, Math.round((base + lead.score) / 2)));
  return { score, reason: `Deterministic estimate based on ${lead.status} status` };
}

export class LeadScoreService {
  constructor(private readonly provider?: AiProvider) {}

  async scoreLead(context: DomainContext, leadId: string) {
    const lead = await prisma.leadProfile.findFirst({
      where: { id: leadId, organizationId: context.organizationId },
      include: { agent: true },
    });
    if (!lead) throw new DomainError('NOT_FOUND', 'Lead not found');

    const provider = this.provider ?? createAiProvider();
    const prompt =
      'Score this lead from 0 to 100 for conversion likelihood. ' +
      'Respond with ONLY a JSON object: {"score": <0-100>, "reason": "<short reason>"}.\n' +
      `Lead: name=${lead.name ?? 'unknown'}, phone=${lead.phone}, status=${lead.status}, ` +
      `current score=${lead.score}, agent=${lead.agent?.name ?? 'none'}`;
    const result = await provider.complete({
      model: SCORE_MODEL,
      messages: [
        { role: 'system', content: 'You are a lead scoring engine. Respond only with JSON.' },
        { role: 'user', content: prompt },
      ],
    });

    const parsed = parseScoreJson(result.content);
    const scored = parsed ?? fallbackScore(lead);
    const updated = await prisma.leadProfile.update({
      where: { id: lead.id },
      data: { score: scored.score, scoreReason: scored.reason, lastScoredAt: new Date() },
    });
    await writeAuditEvent(context, 'LEAD_SCORED', {
      leadId: lead.id,
      score: scored.score,
      reason: scored.reason,
      source: parsed ? 'ai' : 'fallback',
    });
    return updated;
  }
}