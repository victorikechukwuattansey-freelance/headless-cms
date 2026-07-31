import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const BrandShowcase: Scene = () => (
  <>
    {/* Decorative tech geometry */}
    <Ellipse x={860} y={-180} w={520} h={520} fill="var(--ox-accent)" opacity={0.05} />
    <Ellipse x={960} y={-80} w={240} h={240} fill="var(--ox-accent2)" opacity={0.06} />

    {/* ── Logo lockup ── */}
    <Group x={80} y={80} name="Logo Lockup">
      {/* Icon mark — abstract N / node */}
      <Box x={0} y={0} w={56} h={56} radius={14} fill="var(--ox-accent)" />
      <Box x={8} y={8} w={40} h={40} radius={10} fill="var(--ox-bg)" />
      <Box x={16} y={16} w={24} h={24} radius={6} fill="var(--ox-accent2)" />

      {/* Wordmark */}
      <Text x={76} y={0} w={600} size={44} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        NovaTech
      </Text>
      <Text x={76} y={54} w={600} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Solutions
      </Text>
    </Group>

    <Line x={80} y={180} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />

    {/* ── Color Palette ── */}
    <Group x={80} y={220} name="Color Palette">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Color Palette
      </Text>

      <Box x={0} y={28} w={160} h={96} radius={8} fill="var(--ox-accent)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#2563EB</Text>
      </Box>
      <Box x={176} y={28} w={160} h={96} radius={8} fill="var(--ox-accent2)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#06B6D4</Text>
      </Box>
      <Box x={352} y={28} w={160} h={96} radius={8} fill="var(--ox-fg)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#0F172A</Text>
      </Box>
      <Box x={528} y={28} w={160} h={96} radius={8} fill="var(--ox-muted)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#64748B</Text>
      </Box>
      <Box x={704} y={28} w={160} h={96} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#F8FAFC</Text>
      </Box>
    </Group>

    {/* ── Typography ── */}
    <Group x={80} y={380} name="Typography">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Typography
      </Text>

      <Text x={0} y={32} w={600} size={42} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Inter Display
      </Text>
      <Text x={0} y={84} w={600} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>
        Display — headings, logo, emphasis
      </Text>

      <Text x={0} y={128} w={600} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        Inter Body — clean, legible, modern. Every weight from 300 to 800.
      </Text>
      <Text x={0} y={168} w={600} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>
        Body — copy, descriptions, UI labels
      </Text>
    </Group>

    {/* ── Logo Variations ── */}
    <Group x={80} y={500} name="Logo Variations">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Logo Suite
      </Text>

      {/* Primary horizontal */}
      <Group x={0} y={28} name="Primary">
        <Box x={0} y={71} w={32} h={32} radius={8} fill="var(--ox-accent)" />
        <Box x={6} y={77} w={20} h={20} radius={5} fill="var(--ox-accent2)" />
        <Text x={44} y={79} w={300} size={22} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
          NovaTech
        </Text>
      </Group>

      {/* Stacked */}
      <Group x={320} y={28} name="Stacked">
        <Box x={-4} y={47} w={28} h={28} radius={7} fill="var(--ox-accent)" />
        <Box x={2} y={53} w={16} h={16} radius={4} fill="var(--ox-accent2)" />
        <Text x={-4} y={81} w={200} size={18} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
          NovaTech
        </Text>
        <Text x={-3} y={104} w={200} size={10} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
          Solutions
        </Text>
      </Group>

      {/* Icon only */}
      <Group x={560} y={28} name="Icon Mark">
        <Box x={-24} y={67} w={48} h={48} radius={12} fill="var(--ox-accent)" />
        <Box x={-16} y={75} w={32} h={32} radius={8} fill="var(--ox-bg)" />
        <Box x={-10} y={81} w={20} h={20} radius={5} fill="var(--ox-accent2)" />
        <Text x={40} y={94} w={200} size={12} weight={500} color="var(--ox-muted)" font="body">
          Icon mark
        </Text>
      </Group>
    </Group>

    {/* ── Iconography samples ── */}
    <Group x={80} y={660} name="Iconography">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Iconography
      </Text>

      <Box x={0} y={28} w={56} h={56} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={14} w={56} align="center" size={22} color="var(--ox-accent)" font="body">⚡</Text>
      </Box>
      <Box x={72} y={28} w={56} h={56} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={14} w={56} align="center" size={22} color="var(--ox-accent)" font="body">◆</Text>
      </Box>
      <Box x={144} y={28} w={56} h={56} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={14} w={56} align="center" size={22} color="var(--ox-accent)" font="body">●</Text>
      </Box>
      <Box x={216} y={28} w={56} h={56} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={14} w={56} align="center" size={22} color="var(--ox-accent2)" font="body">⊞</Text>
      </Box>
      <Box x={288} y={28} w={56} h={56} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={14} w={56} align="center" size={22} color="var(--ox-accent2)" font="body">⌁</Text>
      </Box>
    </Group>

    {/* Footer */}
    <Line x={80} y={820} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={840} w={600} size={11} weight={500} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      NovaTech Solutions — Brand Identity System
    </Text>
  </>
);

BrandShowcase.id = 'novatech-brand';
BrandShowcase.label = 'Brand Showcase';

export const meta: DesignMeta = {
  theme: 'novatech',
  title: 'NovaTech Solutions — Brand Identity',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BrandShowcase] satisfies Scene[];
