import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const SectionHeading = ({ title, y }: { title: string; y: number }) => (
  <Group x={0} y={y} name="Section Heading">
    <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
      {title}
    </Text>
    <Line x={0} y={20} w={1040} thickness={1} color="var(--ox-muted)" opacity={0.15} />
  </Group>
);

const ComponentsShowcase: Scene = () => (
  <>
    {/* Header */}
    <Group x={40} y={40} name="Header">
      <Text x={0} y={0} w={600} size={36} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Design System
      </Text>
      <Text x={0} y={44} w={800} size={14} weight={400} color="var(--ox-muted)" font="body">
        Universal Social Media Design System — Component Library
      </Text>
    </Group>

    <SectionHeading title="Buttons" y={100} />

    {/* Primary Button */}
    <Box x={40} y={140} w={160} h={48} radius={24} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={160} h={48} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body" letterSpacing={0.5}>
        Primary
      </Text>
    </Box>

    {/* Secondary */}
    <Box x={220} y={140} w={160} h={48} radius={24} fill="var(--ox-surface)" borderColor="var(--ox-accent)" borderWidth={2} center>
      <Text x={0} y={0} w={160} h={48} align="center" valign="center" size={13} weight={600} color="var(--ox-accent)" font="body" letterSpacing={0.5}>
        Secondary
      </Text>
    </Box>

    {/* Outline */}
    <Box x={400} y={140} w={160} h={48} radius={24} borderColor="var(--ox-muted)" borderWidth={1.5} center>
      <Text x={0} y={0} w={160} h={48} align="center" valign="center" size={13} weight={500} color="var(--ox-muted)" font="body">
        Outline
      </Text>
    </Box>

    {/* Ghost */}
    <Box x={580} y={140} w={160} h={48} radius={24} center>
      <Text x={0} y={0} w={160} h={48} align="center" valign="center" size={13} weight={500} color="var(--ox-accent)" font="body">
        Ghost
      </Text>
    </Box>

    {/* CTA Button */}
    <Box x={760} y={140} w={200} h={56} radius={28} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={200} h={56} align="center" valign="center" size={14} weight={700} color="var(--ox-bg)" font="body" letterSpacing={0.5}>
        CTA Button
      </Text>
    </Box>

    <SectionHeading title="Badges & Tags" y={220} />

    {/* Badges */}
    <Box x={40} y={260} w={100} h={28} radius={14} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={100} h={28} align="center" valign="center" size={11} weight={600} color="var(--ox-bg)" font="body">New</Text>
    </Box>
    <Box x={156} y={260} w={100} h={28} radius={14} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={100} h={28} align="center" valign="center" size={11} weight={600} color="var(--ox-bg)" font="body">Sale</Text>
    </Box>
    <Box x={272} y={260} w={120} h={28} radius={14} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={120} h={28} align="center" valign="center" size={11} weight={500} color="var(--ox-muted)" font="body">Featured</Text>
    </Box>
    <Box x={408} y={260} w={140} h={28} radius={14} fill="#059669" opacity={0.1} center>
      <Text x={0} y={0} w={140} h={28} align="center" valign="center" size={11} weight={600} color="#059669" font="body">In Stock</Text>
    </Box>
    <Box x={564} y={260} w={140} h={28} radius={14} fill="#dc2626" opacity={0.1} center>
      <Text x={0} y={0} w={140} h={28} align="center" valign="center" size={11} weight={600} color="#dc2626" font="body">Limited</Text>
    </Box>

    <SectionHeading title="Cards" y={320} />

    {/* Basic Card */}
    <Box x={40} y={360} w={240} h={200} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 2px 8px rgba(0,0,0,0.06)">
      <Box x={0} y={0} w={240} h={100} radius={0} fill="var(--ox-accent)" opacity={0.1} />
      <Text x={20} y={120} w={200} size={16} weight={600} color="var(--ox-fg)" font="display">Card Title</Text>
      <Text x={20} y={148} w={200} size={12} weight={400} color="var(--ox-muted)" font="body">Supporting description text here.</Text>
    </Box>

    {/* Feature Card */}
    <Box x={300} y={360} w={240} h={200} radius={16} fill="var(--ox-accent)" center>
      <Text x={20} y={40} w={200} size={32} color="var(--ox-bg)" font="display">✦</Text>
      <Text x={20} y={80} w={200} size={16} weight={600} color="var(--ox-bg)" font="display">Feature</Text>
      <Text x={20} y={108} w={200} size={12} weight={400} color="var(--ox-bg)" font="body" opacity={0.8}>Short feature description.</Text>
    </Box>

    {/* Stat Card */}
    <Box x={560} y={360} w={200} h={200} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={40} w={200} align="center" size={48} weight={700} color="var(--ox-accent)" font="display">99%</Text>
      <Text x={0} y={100} w={200} align="center" size={13} weight={500} color="var(--ox-muted)" font="body">Satisfaction</Text>
    </Box>

    {/* Testimonial Card */}
    <Box x={780} y={360} w={240} h={200} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={20} y={24} w={200} size={36} color="var(--ox-accent)" font="display">"</Text>
      <Text x={20} y={60} w={200} size={12} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        Amazing product that transformed our workflow.
      </Text>
      <Text x={20} y={120} w={200} size={11} weight={600} color="var(--ox-muted)" font="body">— Client Name</Text>
    </Box>

    <SectionHeading title="Media Placeholders" y={600} />

    {/* Image placeholder */}
    <Box x={40} y={640} w={200} h={200} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={200} h={200} align="center" valign="center" size={32} color="var(--ox-muted)" font="body" opacity={0.4}>🖼</Text>
    </Box>

    {/* Video placeholder */}
    <Box x={260} y={640} w={200} h={200} radius={12} fill="var(--ox-fg)" center>
      <Box x={80} y={80} w={40} h={40} radius={20} fill="var(--ox-accent)" center>
        <Text x={0} y={0} w={40} h={40} align="center" valign="center" size={16} color="var(--ox-bg)" font="body">▶</Text>
      </Box>
    </Box>

    {/* Avatar */}
    <Box x={500} y={640} w={80} h={80} radius={40} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={80} h={80} align="center" valign="center" size={28} weight={600} color="var(--ox-bg)" font="display">JD</Text>
    </Box>

    <SectionHeading title="Dividers & Accents" y={880} />

    <Line x={40} y={920} w={200} thickness={1} color="var(--ox-muted)" opacity={0.3} />
    <Line x={260} y={920} w={200} thickness={2} color="var(--ox-accent)" />
    <Line x={480} y={920} w={200} thickness={3} color="var(--ox-accent2)" />
    <Line x={700} y={920} w={100} thickness={4} color="var(--ox-accent)" opacity={0.5} />
  </>
);

ComponentsShowcase.id = 'universal-components';
ComponentsShowcase.label = 'Components';

export const meta: DesignMeta = {
  theme: 'universal',
  title: 'Universal Social Media Design System — Components',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ComponentsShowcase] satisfies Scene[];
