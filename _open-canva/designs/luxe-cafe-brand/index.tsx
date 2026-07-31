import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const BrandShowcase: Scene = () => (
  <>
    {/* Decorative circles */}
    <Ellipse x={860} y={-100} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />
    <Ellipse x={-60} y={760} w={360} h={360} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Logo lockup */}
    <Group x={80} y={80} name="Logo Lockup">
      {/* Icon — espresso cup abstract */}
      <Box x={0} y={4} w={40} h={32} radius={4} fill="var(--ox-accent)" />
      <Box x={6} y={10} w={28} h={20} radius={2} fill="var(--ox-accent2)" />
      <Box x={14} y={36} w={12} h={8} radius={2} fill="var(--ox-accent)" />

      <Text x={56} y={0} w={600} size={44} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        Luxe Café
      </Text>
      <Text x={58} y={52} w={600} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Premium Coffee & Pastry
      </Text>
    </Group>

    <Line x={80} y={180} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />

    {/* Color palette */}
    <Group x={80} y={220} name="Color Palette">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Brand Colors</Text>

      <Box x={0} y={28} w={160} h={96} radius={16} fill="var(--ox-accent)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#3C2415</Text>
      </Box>
      <Box x={176} y={28} w={160} h={96} radius={16} fill="var(--ox-accent2)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#C68E4E</Text>
      </Box>
      <Box x={352} y={28} w={160} h={96} radius={16} fill="var(--ox-fg)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#2C1810</Text>
      </Box>
      <Box x={528} y={28} w={160} h={96} radius={16} fill="var(--ox-muted)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#A0846A</Text>
      </Box>
      <Box x={704} y={28} w={160} h={96} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#FFF8F0</Text>
      </Box>
    </Group>

    {/* Typography */}
    <Group x={80} y={380} name="Typography">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Typography</Text>

      <Text x={0} y={32} w={700} size={44} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        Playfair Display
      </Text>
      <Text x={0} y={84} w={600} size={14} weight={500} color="var(--ox-muted)" font="body">
        Display — elegant serif for logo, headings, menu
      </Text>

      <Text x={0} y={128} w={600} size={18} weight={400} color="var(--ox-fg)" font="body">
        Inter — clean sans-serif for body copy, descriptions, labels.
      </Text>
      <Text x={0} y={168} w={600} size={14} weight={500} color="var(--ox-muted)" font="body">
        Body — menu items, prices, web copy
      </Text>
    </Group>

    {/* Logo variations */}
    <Group x={80} y={500} name="Logo Variations">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Logo Suite</Text>

      <Group x={0} y={28} name="Primary">
        <Box x={0} y={2} w={24} h={20} radius={3} fill="var(--ox-accent)" />
        <Box x={4} y={6} w={16} h={12} radius={2} fill="var(--ox-accent2)" />
        <Box x={8} y={22} w={8} h={6} radius={2} fill="var(--ox-accent)" />
        <Text x={36} y={0} w={300} size={22} weight={700} color="var(--ox-fg)" font="display">Luxe Café</Text>
      </Group>

      <Group x={320} y={28} name="Stacked">
        <Box x={16} y={0} w={28} h={22} radius={4} fill="var(--ox-accent)" />
        <Box x={20} y={4} w={20} h={14} radius={2} fill="var(--ox-accent2)" />
        <Box x={26} y={24} w={8} h={6} radius={2} fill="var(--ox-accent)" />
        <Text x={0} y={40} w={200} size={18} weight={700} color="var(--ox-fg)" font="display">Luxe Café</Text>
        <Text x={0} y={60} w={200} size={10} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Premium Coffee</Text>
      </Group>

      <Group x={580} y={28} name="Icon Mark">
        <Box x={0} y={4} w={40} h={32} radius={5} fill="var(--ox-accent)" />
        <Box x={6} y={10} w={28} h={20} radius={3} fill="var(--ox-accent2)" />
        <Box x={14} y={36} w={12} h={8} radius={2} fill="var(--ox-accent)" />
        <Text x={52} y={10} w={200} size={12} weight={500} color="var(--ox-muted)" font="body">Cup mark</Text>
      </Group>
    </Group>

    {/* Decorative pattern */}
    <Group x={80} y={660} name="Pattern">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Brand Pattern</Text>
      <Ellipse x={0} y={28} w={16} h={16} fill="var(--ox-accent2)" opacity={0.2} />
      <Ellipse x={28} y={28} w={16} h={16} fill="var(--ox-accent)" opacity={0.15} />
      <Ellipse x={56} y={28} w={16} h={16} fill="var(--ox-accent2)" opacity={0.12} />
      <Ellipse x={84} y={28} w={16} h={16} fill="var(--ox-accent)" opacity={0.1} />
      <Ellipse x={112} y={28} w={16} h={16} fill="var(--ox-accent2)" opacity={0.18} />
      <Ellipse x={140} y={28} w={16} h={16} fill="var(--ox-accent)" opacity={0.08} />
      <Ellipse x={168} y={28} w={16} h={16} fill="var(--ox-accent2)" opacity={0.15} />
      <Ellipse x={196} y={28} w={16} h={16} fill="var(--ox-accent)" opacity={0.12} />
    </Group>

    <Line x={80} y={800} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={820} w={600} size={11} weight={500} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Luxe Café — Brand Identity System
    </Text>
  </>
);

BrandShowcase.id = 'luxe-cafe-brand';
BrandShowcase.label = 'Brand Identity';

export const meta: DesignMeta = {
  theme: 'luxecafe',
  title: 'Luxe Café — Brand Identity',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BrandShowcase] satisfies Scene[];
