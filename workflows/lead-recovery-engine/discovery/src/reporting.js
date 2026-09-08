'use strict';

const { isSuppressed } = require('./lib/suppress');

function buildOutreachReport(prospectRows, activityRows) {
  const total = prospectRows.length;
  const suppressed = prospectRows.filter((r) => isSuppressed(r)).length;
  const active = total - suppressed;

  const byStatus = {};
  for (const r of prospectRows) {
    const s = r.outreach_status || 'not_ready';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const outreachContacted = activityRows.filter((a) => a.status === 'sent').length;
  const outreachReplied = activityRows.filter((a) => a.response_type && a.response_type !== 'no_response' && a.response_type !== '').length;
  const qualified = prospectRows.filter((r) => r.outreach_status === 'qualified').length;
  const demo = prospectRows.filter((r) => r.outreach_status === 'demo').length;
  const won = prospectRows.filter((r) => r.outreach_status === 'won').length;
  const lost = prospectRows.filter((r) => r.outreach_status === 'lost').length;

  const replyRate = outreachContacted > 0 ? Math.round((outreachReplied / outreachContacted) * 100) : 0;
  const qualificationRate = outreachReplied > 0 ? Math.round((qualified / outreachReplied) * 100) : 0;
  const conversionRate = outreachContacted > 0 ? Math.round((won / outreachContacted) * 100) : 0;

  const channelBreakdown = {};
  for (const a of activityRows) {
    const ch = a.channel || 'unknown';
    if (!channelBreakdown[ch]) channelBreakdown[ch] = { sent: 0, replied: 0 };
    if (a.status === 'sent') channelBreakdown[ch].sent++;
    if (a.response_type && a.response_type !== 'no_response') channelBreakdown[ch].replied++;
  }

  return {
    total_prospects: total,
    active_prospects: active,
    suppressed_prospects: suppressed,
    by_status: byStatus,
    activities: {
      total: activityRows.length,
      sent: outreachContacted,
      replied: outreachReplied,
      reply_rate_pct: replyRate,
    },
    outcomes: {
      qualified,
      demo,
      won,
      lost,
      qualification_rate_pct: qualificationRate,
      conversion_rate_pct: conversionRate,
    },
    channels: channelBreakdown,
  };
}

module.exports = {
  buildOutreachReport,
};
