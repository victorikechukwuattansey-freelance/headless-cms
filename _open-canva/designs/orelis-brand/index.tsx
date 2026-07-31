import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const BrandShowcase: Scene = () => (
  <>
    {/* Decorative accent ellipse top-right */}
    <Ellipse x={880} y={-140} w={500} h={500} fill="var(--ox-accent)" opacity={0.06} />

    {/* ── Logo lockup ── */}
    <Group x={80} y={80} name="Logo Lockup">
      {/* Icon mark — stylised diamond */}
      <Box x={0} y={0} w={64} h={64} fill="var(--ox-accent)" />
      <Box x={8} y={8} w={48} h={48} fill="var(--ox-bg)" />
      <Box x={16} y={16} w={32} h={32} fill="var(--ox-accent2)" />

      {/* Wordmark */}
      <Text x={88} y={0} w={600} size={56} weight={700} color="var(--ox-fg)" font="display" letterSpacing={8} uppercase>
        ORELIS
      </Text>
      <Text x={88} y={68} w={600} size={16} weight={400} color="var(--ox-muted)" font="body" letterSpacing={4} uppercase>
        Luxury fashion
      </Text>
    </Group>

    {/* ── Divider ── */}
    <Line x={80} y={200} w={920} thickness={1} color="var(--ox-muted)" opacity={0.3} />

    {/* ── Color Palette ── */}
    <Group x={80} y={240} name="Color Palette">
      <Text x={0} y={0} w={400} size={12} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Color Palette
      </Text>

      {/* Swatches */}
      <Box x={0} y={32} w={160} h={100} fill="var(--ox-accent)">
        <Text x={0} y={72} w={160} align="center" size={11} color="var(--ox-bg)" font="body" letterSpacing={1}>
          #6B1A2A
        </Text>
      </Box>
      <Box x={176} y={32} w={160} h={100} fill="var(--ox-accent2)">
        <Text x={0} y={72} w={160} align="center" size={11} color="var(--ox-fg)" font="body" letterSpacing={1}>
          #C9A84C
        </Text>
      </Box>
      <Box x={352} y={32} w={160} h={100} fill="var(--ox-fg)">
        <Text x={0} y={72} w={160} align="center" size={11} color="var(--ox-bg)" font="body" letterSpacing={1}>
          #1A1A1A
        </Text>
      </Box>
      <Box x={528} y={32} w={160} h={100} fill="var(--ox-muted)">
        <Text x={0} y={72} w={160} align="center" size={11} color="var(--ox-bg)" font="body" letterSpacing={1}>
          #8A7A6A
        </Text>
      </Box>
      <Box x={704} y={32} w={160} h={100} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={72} w={160} align="center" size={11} color="var(--ox-fg)" font="body" letterSpacing={1}>
          #FFFFFF
        </Text>
      </Box>
    </Group>

    {/* ── Typography ── */}
    <Group x={80} y={420} name="Typography">
      <Text x={0} y={0} w={400} size={12} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Typography
      </Text>
      <Text x={0} y={36} w={600} size={48} weight={400} color="var(--ox-fg)" font="display" letterSpacing={2}>
        Cormorant Garamond
      </Text>
      <Text x={0} y={96} w={600} size={14} weight={400} color="var(--ox-muted)" font="body" letterSpacing={1}>
        Display — headings, logo, pull quotes
      </Text>

      <Text x={0} y={120} w={600} size={20} weight={300} color="var(--ox-fg)" font="body" letterSpacing={1}>
        Inter — the body typeface, clean and legible
      </Text>
      <Text x={0} y={172} w={600} size={14} weight={400} color="var(--ox-muted)" font="body" letterSpacing={1}>
        Body — copy, descriptions, labels
      </Text>
    </Group>

    {/* ── Logo variations ── */}
    <Group x={80} y={580} name="Logo Variations">
      <Text x={0} y={-8} w={400} size={12} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Logo Variations
      </Text>

      {/* Primary */}
      <Group x={0} y={32} name="Primary Logo">
        <Box x={0} y={0} w={40} h={40} fill="var(--ox-accent)" />
        <Box x={6} y={6} w={28} h={28} fill="var(--ox-accent2)" />
        <Text x={48} y={9} w={300} size={28} weight={700} color="var(--ox-fg)" font="display" letterSpacing={4} uppercase>
          ORELIS
        </Text>
      </Group>

      {/* Secondary */}
      <Group x={0} y={96} name="Secondary Logo">
        <Box x={0} y={0} w={32} h={32} fill="var(--ox-accent2)" />
        <Text x={48} y={0} w={300} size={20} weight={600} color="var(--ox-accent)" font="display" letterSpacing={3} uppercase>
          ORELIS
        </Text>
        <Text x={48} y={28} w={300} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
          Luxury fashion
        </Text>
      </Group>

      {/* Icon mark only */}
      <Group x={360} y={32} name="Icon Mark">
        <Box x={0} y={0} w={56} h={56} fill="var(--ox-accent)" />
        <Box x={8} y={8} w={40} h={40} fill="var(--ox-accent2)" />
        <Text x={72} y={24} w={300} size={14} weight={400} color="var(--ox-muted)" font="body">
          Icon mark
        </Text>
      </Group>
    </Group>

    {/* ── Footer ── */}
    <Line x={80} y={780} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={800} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      House of Orelis — Brand Identity System
    </Text>
  </>
);

BrandShowcase.id = 'orelis-brand';
BrandShowcase.label = 'Brand Showcase';

export const meta: DesignMeta = {
  theme: 'orelis',
  title: 'House of Orelis — Brand Identity',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BrandShowcase] satisfies Scene[];
