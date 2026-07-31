import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Thought Leadership ── */
const ThoughtLeadership: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Side accent */}
    <Box x={0} y={0} w={8} h={1080} fill="var(--ox-accent)" />

    {/* Avatar */}
    <Group x={80} y={80} name="Author">
      <Box x={0} y={0} w={64} h={64} radius={32} fill="var(--ox-accent)" center>
        <Text x={0} y={0} w={64} h={64} align="center" valign="center" size={24} weight={600} color="var(--ox-bg)" font="display">AK</Text>
      </Box>
      <Text x={80} y={8} w={400} size={18} weight={600} color="var(--ox-fg)" font="display">Alex Kim</Text>
      <Text x={80} y={34} w={400} size={13} weight={400} color="var(--ox-muted)" font="body">CEO & Founder · 5 min read</Text>
    </Group>

    {/* Headline */}
    <Group x={80} y={200} name="Content">
      <Text x={0} y={0} w={920} size={48} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1.5} lineHeight={1.15}>
        The Future of Digital Marketing
      </Text>
      <Text x={0} y={140} w={920} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        In an era of constant change, the brands that thrive are those that adapt. Here are three principles that guide our strategy...
      </Text>
    </Group>

    {/* Engagement bar */}
    <Group x={80} y={440} name="Engagement">
      <Text x={0} y={0} w={200} size={13} weight={500} color="var(--ox-accent)" font="body">👍 234</Text>
      <Text x={120} y={0} w={200} size={13} weight={500} color="var(--ox-muted)" font="body">💬 18</Text>
      <Text x={240} y={0} w={200} size={13} weight={500} color="var(--ox-muted)" font="body">↗ 45</Text>
    </Group>

    <Line x={80} y={480} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={502} w={600} size={12} weight={400} color="var(--ox-accent)" font="body">
      Continue reading on LinkedIn →
    </Text>
  </>
);
ThoughtLeadership.id = 'thought-leadership';
ThoughtLeadership.label = 'Thought Leadership';

/* ── Scene 2: Company Update ── */
const CompanyUpdate: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Logo area */}
    <Group x={80} y={60} name="Brand">
      <Box x={0} y={0} w={32} h={32} radius={8} fill="var(--ox-bg)" opacity={0.2} />
      <Box x={6} y={6} w={20} h={20} radius={5} fill="var(--ox-bg)" />
      <Text x={44} y={2} w={300} size={18} weight={700} color="var(--ox-bg)" font="display">Company</Text>
    </Group>

    <Group x={80} y={240} name="Update">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Company Update
      </Text>

      <Text x={0} y={40} w={920} size={56} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        New Milestone
      </Text>
      <Text x={0} y={120} w={920} size={40} weight={500} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        Achieved
      </Text>

      <Line x={0} y={184} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={216} w={700} size={16} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.9}>
        We're proud to announce that we've reached over 10,000 customers worldwide. Thank you for being part of this journey.
      </Text>
    </Group>

    {/* Stat */}
    <Box x={80} y={440} w={240} h={100} radius={16} fill="var(--ox-bg)" opacity={0.1} center>
      <Text x={0} y={16} w={240} align="center" size={36} weight={700} color="var(--ox-bg)" font="display">10K+</Text>
      <Text x={0} y={62} w={240} align="center" size={12} weight={400} color="var(--ox-bg)" font="body" opacity={0.8}>Customers</Text>
    </Box>

    {/* Footer */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.15} />
    <Text x={80} y={1000} w={400} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase opacity={0.7}>
      @company
    </Text>
  </>
);
CompanyUpdate.id = 'company-update';
CompanyUpdate.label = 'Company Update';

/* ── Scene 3: Stat / Insight ── */
const StatInsight: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Large stat */}
    <Group x={80} y={240} name="Stat">
      <Text x={0} y={0} w={920} size={96} weight={700} color="var(--ox-accent)" font="display" letterSpacing={-3}>
        73%
      </Text>

      <Line x={0} y={120} w={60} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={148} w={800} size={36} weight={600} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        of consumers prefer
      </Text>
      <Text x={0} y={200} w={800} size={36} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        personalized experiences
      </Text>

      <Text x={0} y={260} w={700} size={15} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Source: Industry Report 2026. Brands that personalize see 40% higher engagement.
      </Text>
    </Group>

    {/* Brand */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1000} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Industry Insights
    </Text>
  </>
);
StatInsight.id = 'stat-insight';
StatInsight.label = 'Stat Insight';

export const meta: DesignMeta = {
  theme: 'universal',
  title: 'Universal Social Media — LinkedIn & Facebook',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ThoughtLeadership, CompanyUpdate, StatInsight] satisfies Scene[];
