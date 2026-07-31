import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Business Card ── */
const BusinessCard: Scene = () => (
  <>
    <Box x={0} y={0} w={1050} h={600} fill="var(--ox-bg)" radius={12} shadow="0 4px 24px rgba(0,0,0,0.08)" />

    {/* Left accent bar */}
    <Box x={0} y={0} w={12} h={600} fill="var(--ox-accent)" radius={0} />

    {/* Logo */}
    <Group x={48} y={48} name="Logo">
      <Box x={0} y={0} w={32} h={32} radius={8} fill="var(--ox-accent)" />
      <Box x={6} y={6} w={20} h={20} radius={5} fill="var(--ox-accent2)" />
      <Text x={44} y={0} w={300} size={22} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        NovaTech
      </Text>
      <Text x={44} y={26} w={300} size={9} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Solutions
      </Text>
    </Group>

    {/* Divider */}
    <Line x={48} y={110} w={400} thickness={1} color="var(--ox-accent)" opacity={0.3} />

    {/* Name & title */}
    <Text x={48} y={140} w={500} size={28} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
      Sarah Mitchell
    </Text>
    <Text x={48} y={176} w={500} size={14} weight={500} color="var(--ox-accent)" font="body" letterSpacing={2} uppercase>
      Chief Technology Officer
    </Text>

    {/* Contact details */}
    <Group x={48} y={240} name="Contact">
      <Text x={0} y={0} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
        s.mitchell@novatech.solutions
      </Text>
      <Text x={0} y={24} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
        +1 (555) 123-4567
      </Text>
      <Text x={0} y={48} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
        novatech.solutions
      </Text>
    </Group>

    {/* Bottom accent */}
    <Line x={48} y={540} w={400} thickness={2} color="var(--ox-accent2)" />
  </>
);
BusinessCard.id = 'business-card';
BusinessCard.label = 'Business Card';

/* ── Scene 2: Letterhead ── */
const Letterhead: Scene = () => (
  <>
    <Box x={0} y={0} w={1240} h={1754} fill="var(--ox-bg)" />

    {/* Header */}
    <Group x={60} y={60} name="Header">
      <Box x={0} y={0} w={28} h={28} radius={7} fill="var(--ox-accent)" />
      <Box x={6} y={6} w={16} h={16} radius={4} fill="var(--ox-accent2)" />
      <Text x={40} y={0} w={400} size={20} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        NovaTech Solutions
      </Text>

      <Text x={780} y={0} w={400} size={10} weight={500} color="var(--ox-muted)" font="body" align="right">
        200 Innovation Drive, Suite 400
      </Text>
      <Text x={780} y={16} w={400} size={10} weight={500} color="var(--ox-muted)" font="body" align="right">
        San Francisco, CA 94105
      </Text>
    </Group>

    <Line x={60} y={120} w={1120} thickness={2} color="var(--ox-accent)" />
    <Line x={60} y={124} w={1120} thickness={1} color="var(--ox-accent2)" opacity={0.5} />

    {/* Date & subject */}
    <Text x={60} y={180} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
      July 27, 2026
    </Text>
    <Text x={60} y={220} w={800} size={18} weight={600} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
      Re: Strategic Partnership Proposal
    </Text>

    {/* Body text placeholders */}
    <Text x={60} y={280} w={800} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.8}>
      Dear Partner,
    </Text>
    <Text x={60} y={320} w={800} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.8}>
      We are pleased to present this proposal for collaboration between our organizations. NovaTech Solutions is committed to delivering innovative technology that drives measurable business outcomes.
    </Text>
    <Text x={60} y={380} w={800} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.8}>
      Our team has extensive experience in enterprise software, cloud infrastructure, and AI-driven analytics. We believe this partnership represents a significant opportunity for both parties.
    </Text>
    <Text x={60} y={440} w={800} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.8}>
      We look forward to discussing this further.
    </Text>
    <Text x={60} y={520} w={800} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.8}>
      Sincerely,
    </Text>

    {/* Signature block */}
    <Group x={60} y={560} name="Signature">
      <Text x={0} y={0} w={400} size={14} weight={600} color="var(--ox-fg)" font="display">
        Sarah Mitchell
      </Text>
      <Text x={0} y={24} w={400} size={11} weight={500} color="var(--ox-accent)" font="body">
        Chief Technology Officer
      </Text>
      <Text x={0} y={44} w={400} size={10} weight={400} color="var(--ox-muted)" font="body">
        s.mitchell@novatech.solutions
      </Text>
    </Group>

    {/* Footer */}
    <Line x={60} y={1720} w={1120} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={60} y={1734} w={500} size={9} weight={400} color="var(--ox-muted)" font="body">
      NovaTech Solutions — 200 Innovation Drive, Suite 400, San Francisco, CA 94105
    </Text>
  </>
);
Letterhead.id = 'letterhead';
Letterhead.label = 'Letterhead';

/* ── Scene 3: Email Signature ── */
const EmailSignature: Scene = () => (
  <>
    <Box x={0} y={0} w={600} h={200} fill="var(--ox-bg)" />

    <Group x={24} y={24} name="Signature">
      <Box x={0} y={0} w={36} h={36} radius={9} fill="var(--ox-accent)" />
      <Box x={7} y={7} w={22} h={22} radius={5} fill="var(--ox-accent2)" />

      <Text x={48} y={0} w={300} size={16} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
        Sarah Mitchell
      </Text>
      <Text x={48} y={22} w={300} size={11} weight={500} color="var(--ox-accent)" font="body" letterSpacing={1}>
        Chief Technology Officer
      </Text>

      <Line x={0} y={60} w={400} thickness={1} color="var(--ox-muted)" opacity={0.3} />

      <Text x={0} y={80} w={400} size={11} weight={400} color="var(--ox-muted)" font="body">
        s.mitchell@novatech.solutions
      </Text>
      <Text x={0} y={100} w={400} size={11} weight={400} color="var(--ox-muted)" font="body">
        +1 (555) 123-4567
      </Text>
      <Text x={0} y={120} w={400} size={11} weight={400} color="var(--ox-muted)" font="body">
        novatech.solutions
      </Text>
    </Group>
  </>
);
EmailSignature.id = 'email-signature';
EmailSignature.label = 'Email Signature';

export const meta: DesignMeta = {
  theme: 'novatech',
  title: 'NovaTech Solutions — Stationery',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1240, h: 1754 };

export default [BusinessCard, Letterhead, EmailSignature] satisfies Scene[];
