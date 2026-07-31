import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Product Label ── */
const ProductLabel: Scene = () => (
  <>
    {/* Label background */}
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative leaf pattern background */}
    <Group x={80} y={80} name="Decorative Pattern" opacity={0.06}>
      <Ellipse x={0} y={0} w={60} h={60} fill="var(--ox-accent)" />
      <Ellipse x={120} y={80} w={40} h={40} fill="var(--ox-accent)" />
      <Ellipse x={240} y={20} w={50} h={50} fill="var(--ox-accent2)" />
      <Ellipse x={360} y={100} w={35} h={35} fill="var(--ox-accent)" />
      <Ellipse x={500} y={40} w={55} h={55} fill="var(--ox-accent2)" />
      <Ellipse x={640} y={90} w={45} h={45} fill="var(--ox-accent)" />
      <Ellipse x={780} y={30} w={50} h={50} fill="var(--ox-accent2)" />
      <Ellipse x={920} y={70} w={40} h={40} fill="var(--ox-accent)" />
    </Group>

    {/* Main label card */}
    <Box x={140} y={100} w={800} h={880} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 8px 32px rgba(0,0,0,0.06)" />

    {/* Top green band */}
    <Box x={140} y={100} w={800} h={160} radius={0} fill="var(--ox-accent)" />

    {/* Logo on label */}
    <Group x={220} y={130} name="Label Logo">
      <Ellipse x={0} y={4} w={28} h={28} fill="var(--ox-bg)" opacity={0.3} />
      <Ellipse x={4} y={8} w={20} h={20} fill="var(--ox-bg)" />
      <Ellipse x={9} y={11} w={10} h={14} fill="var(--ox-accent2)" />
      <Text x={38} y={0} w={400} size={22} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-0.3}>
        Green Harvest
      </Text>
      <Text x={38} y={30} w={400} size={10} weight={500} color="var(--ox-bg)" font="body" letterSpacing={3} uppercase>
        Organics
      </Text>
    </Group>

    {/* Product name */}
    <Group x={220} y={300} name="Product Name">
      <Text x={0} y={0} w={640} size={52} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Organic
      </Text>
      <Text x={0} y={60} w={640} size={44} weight={600} color="var(--ox-accent)" font="display" letterSpacing={-0.5}>
        Quinoa Blend
      </Text>

      <Line x={0} y={120} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={148} w={640} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Premium organic quinoa with ancient grains. Grown sustainably, harvested with care.
      </Text>
    </Group>

    {/* Weight / info */}
    <Group x={220} y={520} name="Meta">
      <Box x={0} y={0} w={120} h={40} radius={20} fill="var(--ox-accent)" opacity={0.1}>
        <Text x={0} y={0} w={120} h={40} align="center" valign="center" size={12} weight={600} color="var(--ox-accent)" font="body">
          500g
        </Text>
      </Box>
      <Box x={136} y={0} w={140} h={40} radius={20} fill="var(--ox-accent2)" opacity={0.1}>
        <Text x={0} y={0} w={140} h={40} align="center" valign="center" size={12} weight={600} color="var(--ox-accent2)" font="body">
          Gluten Free
        </Text>
      </Box>
      <Box x={292} y={0} w={120} h={40} radius={20} fill="#8DB580" opacity={0.15}>
        <Text x={0} y={0} w={120} h={40} align="center" valign="center" size={12} weight={600} color="#5a7a4e" font="body">
          Non-GMO
        </Text>
      </Box>
    </Group>

    {/* Bottom section */}
    <Line x={220} y={620} w={640} thickness={1} color="var(--ox-muted)" opacity={0.2} />

    {/* Leaf decoration */}
    <Ellipse x={460} y={660} w={160} h={160} fill="var(--ox-accent)" opacity={0.06} />
    <Ellipse x={510} y={700} w={60} h={80} fill="var(--ox-accent)" opacity={0.15} />

    <Text x={220} y={860} w={640} size={10} weight={500} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Product of Ghana — Certified Organic
    </Text>
  </>
);
ProductLabel.id = 'product-label';
ProductLabel.label = 'Product Label';

/* ── Scene 2: Jar mockup ── */
const JarMockup: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Jar body */}
    <Box x={340} y={80} w={400} h={700} radius={40} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 8px 40px rgba(0,0,0,0.08)" />

    {/* Lid */}
    <Box x={320} y={60} w={440} h={50} radius={8} fill="var(--ox-muted)" opacity={0.3} />
    <Box x={330} y={52} w={420} h={16} radius={4} fill="var(--ox-muted)" opacity={0.2} />

    {/* Label on jar */}
    <Box x={380} y={200} w={320} h={460} radius={12} fill="var(--ox-bg)" />

    {/* Leaf icon */}
    <Ellipse x={480} y={230} w={40} h={40} fill="var(--ox-accent)" opacity={0.2} />
    <Ellipse x={488} y={238} w={24} h={24} fill="var(--ox-accent)" />
    <Ellipse x={494} y={243} w={12} h={16} fill="var(--ox-accent2)" />

    <Text x={390} y={290} w={300} align="center" size={22} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
      Green Harvest
    </Text>
    <Text x={390} y={320} w={300} align="center" size={10} weight={500} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
      Organics
    </Text>

    <Line x={460} y={350} w={160} thickness={1} color="var(--ox-accent2)" opacity={0.5} />

    <Text x={390} y={370} w={300} align="center" size={30} weight={700} color="var(--ox-accent)" font="display">
      Quinoa
    </Text>
    <Text x={390} y={410} w={300} align="center" size={14} weight={400} color="var(--ox-muted)" font="body">
      Premium organic quinoa
    </Text>

    {/* Bottom of jar */}
    <Line x={380} y={660} w={320} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Ellipse x={500} y={610} w={80} h={30} fill="var(--ox-accent)" opacity={0.08} />
  </>
);
JarMockup.id = 'jar-mockup';
JarMockup.label = 'Jar Mockup';

/* ── Scene 3: Label Detail ── */
const LabelDetail: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Ingredients panel */}
    <Box x={160} y={100} w={760} h={880} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} />

    <Group x={200} y={140} name="Label Content">
      <Text x={0} y={0} w={680} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Ingredients
      </Text>
      <Line x={0} y={16} w={680} thickness={1} color="var(--ox-muted)" opacity={0.2} />

      <Text x={0} y={40} w={680} size={14} weight={400} color="var(--ox-fg)" font="body" lineHeight={2}>
        Organic quinoa, brown rice, amaranth, millet, chia seeds, flaxseed.
      </Text>

      <Text x={0} y={140} size={11} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Nutritional Information
      </Text>
      <Line x={0} y={156} w={680} thickness={1} color="var(--ox-muted)" opacity={0.2} />

      <Text x={30} y={180} w={400} size={13} weight={400} color="var(--ox-fg)" font="body">Energy</Text>
      <Text x={600} y={180} w={80} size={13} weight={600} color="var(--ox-fg)" font="body" align="right">356 kcal</Text>
      <Text x={30} y={209} w={400} size={13} weight={400} color="var(--ox-fg)" font="body">Protein</Text>
      <Text x={600} y={208} w={80} size={13} weight={600} color="var(--ox-fg)" font="body" align="right">14 g</Text>
      <Text x={30} y={236} w={400} size={13} weight={400} color="var(--ox-fg)" font="body">Carbohydrates</Text>
      <Text x={600} y={236} w={80} size={13} weight={600} color="var(--ox-fg)" font="body" align="right">64 g</Text>
      <Text x={30} y={264} w={400} size={13} weight={400} color="var(--ox-fg)" font="body">Fat</Text>
      <Text x={600} y={264} w={80} size={13} weight={600} color="var(--ox-fg)" font="body" align="right">6 g</Text>
      <Text x={30} y={292} w={400} size={13} weight={400} color="var(--ox-fg)" font="body">Fiber</Text>
      <Text x={600} y={292} w={80} size={13} weight={600} color="var(--ox-fg)" font="body" align="right">7 g</Text>

      <Line x={13} y={345} w={680} thickness={1} color="var(--ox-muted)" opacity={0.2} />

      {/* Certification badges */}
      <Group x={0} y={370} name="Badges">
        <Box x={0} y={0} w={140} h={36} radius={18} fill="var(--ox-accent)" opacity={0.1}>
          <Text x={0} y={0} w={140} h={36} align="center" valign="center" size={11} weight={600} color="var(--ox-accent)" font="body">USDA Organic</Text>
        </Box>
        <Box x={160} y={0} w={140} h={36} radius={18} fill="var(--ox-accent2)" opacity={0.1}>
          <Text x={0} y={0} w={140} h={36} align="center" valign="center" size={11} weight={600} color="var(--ox-accent2)" font="body">Non-GMO</Text>
        </Box>
        <Box x={320} y={0} w={180} h={36} radius={18} fill="#8DB580" opacity={0.15}>
          <Text x={0} y={0} w={180} h={36} align="center" valign="center" size={11} weight={600} color="#5a7a4e" font="body">Fair Trade</Text>
        </Box>
      </Group>
    </Group>
  </>
);
LabelDetail.id = 'label-detail';
LabelDetail.label = 'Label Detail';

export const meta: DesignMeta = {
  theme: 'greenharvest',
  title: 'Green Harvest Organics — Packaging',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ProductLabel, JarMockup, LabelDetail] satisfies Scene[];
