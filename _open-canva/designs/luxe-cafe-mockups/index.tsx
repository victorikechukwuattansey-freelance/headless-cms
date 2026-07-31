import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Coffee Cup Mockup ── */
const CoffeeCup: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative */}
    <Ellipse x={640} y={-80} w={500} h={500} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Cup body */}
    <Box x={340} y={120} w={400} h={520} radius={24} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 8px 40px rgba(0,0,0,0.06)" />

    {/* Cup sleeve / brand band */}
    <Box x={340} y={240} w={400} h={200} fill="var(--ox-accent)" />
    <Ellipse x={340} y={240} w={400} h={24} fill="var(--ox-accent)" opacity={0.85} />

    {/* Logo on cup */}
    <Group x={420} y={300} name="Cup Logo">
      <Box x={0} y={4} w={28} h={22} radius={3} fill="var(--ox-accent2)" opacity={0.9} />
      <Box x={4} y={8} w={20} h={14} radius={2} fill="var(--ox-bg)" />
      <Box x={8} y={28} w={12} h={6} radius={2} fill="var(--ox-accent2)" opacity={0.9} />
      <Text x={40} y={0} w={300} size={22} weight={700} color="var(--ox-bg)" font="display">Luxe Café</Text>
    </Group>

    {/* Lid area */}
    <Box x={360} y={100} w={360} h={30} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} />
    <Ellipse x={460} y={108} w={30} h={14} fill="var(--ox-muted)" opacity={0.3} />
    <Ellipse x={560} y={108} w={16} h={16} fill="var(--ox-muted)" opacity={0.2} />

    {/* Shadow */}
    <Ellipse x={360} y={660} w={360} h={24} fill="var(--ox-fg)" opacity={0.06} />

    {/* Label */}
    <Text x={80} y={740} w={920} align="center" size={13} weight={500} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Reusable cup · 12 oz
    </Text>
  </>
);
CoffeeCup.id = 'coffee-cup';
CoffeeCup.label = 'Coffee Cup';

/* ── Scene 2: Storefront Signage ── */
const StorefrontSignage: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    {/* Wall texture suggestion */}
    <Box x={60} y={60} w={960} h={960} fill="var(--ox-surface)" opacity={0.05} radius={8} />

    {/* Sign board */}
    <Box x={140} y={180} w={800} h={360} radius={8} fill="var(--ox-bg)" shadow="0 12px 48px rgba(0,0,0,0.3)" />

    {/* Sign content */}
    <Group x={220} y={260} name="Sign">
      <Box x={0} y={8} w={48} h={38} radius={5} fill="var(--ox-accent)" />
      <Box x={6} y={14} w={36} h={26} radius={3} fill="var(--ox-accent2)" />
      <Box x={14} y={52} w={20} h={12} radius={3} fill="var(--ox-accent)" />

      <Text x={64} y={0} w={600} size={56} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Luxe Café
      </Text>
      <Text x={66} y={62} w={600} size={16} weight={500} color="var(--ox-muted)" font="body" letterSpacing={4} uppercase>
        Premium Coffee & Pastry
      </Text>
    </Group>

    {/* Open sign */}
    <Box x={400} y={600} w={280} h={64} radius={32} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={280} h={64} align="center" valign="center" size={18} weight={700} color="var(--ox-fg)" font="display" letterSpacing={3} uppercase>
        Open
      </Text>
    </Box>

    {/* Hours */}
    <Group x={340} y={720} name="Hours">
      <Text x={0} y={0} w={400} align="center" size={12} weight={400} color="var(--ox-muted)" font="body">
        Mon–Fri 6:30 AM – 8:00 PM
      </Text>
      <Text x={0} y={20} w={400} align="center" size={12} weight={400} color="var(--ox-muted)" font="body">
        Sat–Sun 7:00 AM – 9:00 PM
      </Text>
    </Group>
  </>
);
StorefrontSignage.id = 'storefront-signage';
StorefrontSignage.label = 'Storefront Signage';

/* ── Scene 3: Cup & Bean Detail ── */
const CupBeanDetail: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Cup silhouette */}
    <Box x={340} y={200} w={400} h={480} radius={24} fill="var(--ox-bg)" opacity={0.06} />
    <Box x={340} y={200} w={400} h={480} radius={24} fill="var(--ox-bg)" opacity={0.04} />

    {/* Coffee bean illustration */}
    <Ellipse x={440} y={280} w={80} h={100} fill="var(--ox-accent2)" opacity={0.9} rotate={-20} />
    <Ellipse x={520} y={340} w={64} h={80} fill="var(--ox-accent2)" opacity={0.7} rotate={15} />
    <Ellipse x={480} y={420} w={72} h={90} fill="var(--ox-accent2)" opacity={0.6} rotate={-10} />

    {/* Steam lines */}
    <Line x={480} y={220} w={2} thickness={2} color="var(--ox-bg)" opacity={0.2} />
    <Line x={510} y={200} w={2} thickness={2} color="var(--ox-bg)" opacity={0.15} />
    <Line x={540} y={215} w={2} thickness={2} color="var(--ox-bg)" opacity={0.18} />

    <Group x={80} y={740} name="Tagline">
      <Text x={0} y={0} w={920} align="center" size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Crafted with passion
      </Text>
    </Group>
  </>
);
CupBeanDetail.id = 'cup-bean-detail';
CupBeanDetail.label = 'Cup & Bean';

export const meta: DesignMeta = {
  theme: 'luxecafe',
  title: 'Luxe Café — Mockups & Signage',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [CoffeeCup, StorefrontSignage, CupBeanDetail] satisfies Scene[];
