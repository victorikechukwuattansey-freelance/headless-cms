import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const BrandShowcase: Scene = () => (
  <>
    {/* Decorative organic shapes */}
    <Ellipse x={860} y={-120} w={460} h={460} fill="var(--ox-accent)" opacity={0.05} />
    <Ellipse x={80} y={780} w={320} h={320} fill="var(--ox-accent2)" opacity={0.04} />

    {/* ── Logo Lockup ── */}
    <Group x={80} y={80} name="Logo Lockup">
      {/* Icon mark — leaf abstract */}
      <Ellipse x={0} y={8} w={48} h={48} fill="var(--ox-accent)" opacity={0.3} />
      <Ellipse x={8} y={16} w={32} h={32} fill="var(--ox-accent)" />
      <Ellipse x={18} y={22} w={14} h={20} fill="var(--ox-accent2)" />

      <Text x={68} y={0} w={600} size={44} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        Green Harvest
      </Text>
      <Text x={70} y={56} w={600} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Organics
      </Text>
    </Group>

    <Line x={80} y={180} w={920} thickness={1} color="var(--ox-muted)" opacity={0.25} />

    {/* ── Color Palette ── */}
    <Group x={80} y={220} name="Color Palette">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Brand Colors
      </Text>

      <Box x={0} y={28} w={160} h={96} radius={12} fill="var(--ox-accent)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#2D5A27</Text>
      </Box>
      <Box x={176} y={28} w={160} h={96} radius={12} fill="var(--ox-accent2)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#C46745</Text>
      </Box>
      <Box x={352} y={28} w={160} h={96} radius={12} fill="#8DB580">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#8DB580</Text>
      </Box>
      <Box x={528} y={28} w={160} h={96} radius={12} fill="var(--ox-muted)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#7A8A70</Text>
      </Box>
      <Box x={704} y={28} w={160} h={96} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#F5F0E8</Text>
      </Box>
    </Group>

    {/* ── Typography ── */}
    <Group x={80} y={380} name="Typography">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Typography
      </Text>

      <Text x={0} y={32} w={700} size={44} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.5}>
        Fraunces
      </Text>
      <Text x={0} y={84} w={600} size={14} weight={500} color="var(--ox-muted)" font="body">
        Display — warm serif for headlines, logo, packaging
      </Text>

      <Text x={0} y={128} w={600} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        Inter — clean sans-serif for body copy, ingredients, labels.
      </Text>
      <Text x={0} y={168} w={600} size={14} weight={500} color="var(--ox-muted)" font="body">
        Body — descriptions, nutritional info, web copy
      </Text>
    </Group>

    {/* ── Logo Variations ── */}
    <Group x={80} y={500} name="Logo Variations">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Logo System
      </Text>

      {/* Horizontal */}
      <Group x={0} y={28} name="Horizontal">
        <Ellipse x={0} y={6} w={28} h={28} fill="var(--ox-accent)" opacity={0.3} />
        <Ellipse x={5} y={11} w={18} h={18} fill="var(--ox-accent)" />
        <Ellipse x={11} y={14} w={8} h={12} fill="var(--ox-accent2)" />
        <Text x={38} y={0} w={300} size={22} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
          Green Harvest
        </Text>
      </Group>

      {/* Stacked */}
      <Group x={360} y={28} name="Stacked">
        <Ellipse x={16} y={0} w={36} h={36} fill="var(--ox-accent)" opacity={0.3} />
        <Ellipse x={22} y={6} w={24} h={24} fill="var(--ox-accent)" />
        <Ellipse x={30} y={10} w={10} h={15} fill="var(--ox-accent2)" />
        <Text x={0} y={44} w={200} size={18} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
          Green Harvest
        </Text>
        <Text x={0} y={64} w={200} size={10} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
          Organics
        </Text>
      </Group>

      {/* Leaf icon only */}
      <Group x={600} y={28} name="Icon Mark">
        <Ellipse x={0} y={6} w={44} h={44} fill="var(--ox-accent)" opacity={0.3} />
        <Ellipse x={6} y={12} w={32} h={32} fill="var(--ox-accent)" />
        <Ellipse x={14} y={17} w={16} h={22} fill="var(--ox-accent2)" />
        <Text x={56} y={14} w={200} size={12} weight={500} color="var(--ox-muted)" font="body">
          Leaf mark
        </Text>
      </Group>
    </Group>

    {/* ── Brand pattern ── */}
    <Group x={80} y={660} name="Pattern">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Brand Pattern
      </Text>
      <Ellipse x={0} y={28} w={24} h={24} fill="var(--ox-accent)" opacity={0.15} />
      <Ellipse x={36} y={28} w={24} h={24} fill="var(--ox-accent2)" opacity={0.15} />
      <Ellipse x={72} y={28} w={24} h={24} fill="#8DB580" opacity={0.2} />
      <Ellipse x={108} y={28} w={24} h={24} fill="var(--ox-accent)" opacity={0.1} />
      <Ellipse x={144} y={28} w={24} h={24} fill="var(--ox-accent2)" opacity={0.12} />
      <Ellipse x={180} y={28} w={24} h={24} fill="#8DB580" opacity={0.15} />
      <Ellipse x={216} y={28} w={24} h={24} fill="var(--ox-accent)" opacity={0.08} />
      <Ellipse x={252} y={28} w={24} h={24} fill="var(--ox-accent2)" opacity={0.1} />
    </Group>

    {/* Footer */}
    <Line x={80} y={800} w={920} thickness={1} color="var(--ox-muted)" opacity={0.25} />
    <Text x={80} y={820} w={600} size={11} weight={500} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Green Harvest Organics — Brand Identity System
    </Text>
  </>
);

BrandShowcase.id = 'greenharvest-brand';
BrandShowcase.label = 'Brand Showcase';

export const meta: DesignMeta = {
  theme: 'greenharvest',
  title: 'Green Harvest Organics — Brand Identity',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BrandShowcase] satisfies Scene[];
