import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Coffee Cup Set ── */
const CoffeeCups: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={-100} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    <Group x={80} y={60} name="Header">
      <Box x={0} y={0} w={32} h={32} radius={4} fill="var(--ox-accent)" />
      <Text x={0} y={0} w={32} h={32} align="center" valign="center" size={16} weight={300} color="var(--ox-bg)" font="display">L</Text>
      <Text x={44} y={2} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Luxe Café</Text>
    </Group>
    <Line x={80} y={108} w={920} thickness={1} color="var(--ox-accent2)" opacity={0.25} />

    <Text x={80} y={140} w={600} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Cup Collection
    </Text>
    <Line x={80} y={192} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Small Cup */}
    <Group x={80} y={240} name="Small Cup">
      <Box x={0} y={0} w={200} h={260} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 4px 20px rgba(0,0,0,0.06)">
        <Box x={20} y={30} w={160} h={200} radius={4} fill="var(--ox-accent)" opacity={0.06} />
        <Box x={20} y={30} w={160} h={80} radius={0} fill="var(--ox-accent)" opacity={0.1} />
        <Box x={80} y={50} w={40} h={40} radius={4} fill="var(--ox-accent)" opacity={0.3} />
        <Text x={80} y={50} w={40} h={40} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={30} y={106} w={140} align="center" size={9} weight={400} color="var(--ox-accent)" font="body" letterSpacing={2} uppercase>Luxe Café</Text>
      </Box>
      <Text x={0} y={280} w={200} align="center" size={12} weight={500} color="var(--ox-fg)" font="body">Small — 8oz</Text>
    </Group>

    {/* Medium Cup */}
    <Group x={340} y={240} name="Medium Cup">
      <Box x={0} y={0} w={240} h={280} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 4px 20px rgba(0,0,0,0.06)">
        <Box x={20} y={30} w={200} h={220} radius={4} fill="var(--ox-accent)" opacity={0.06} />
        <Box x={20} y={30} w={200} h={90} radius={0} fill="var(--ox-accent)" />
        <Box x={80} y={52} w={40} h={40} radius={4} fill="var(--ox-bg)" opacity={0.2} />
        <Text x={80} y={52} w={40} h={40} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={30} y={110} w={180} align="center" size={10} weight={500} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>Luxe Café</Text>
      </Box>
      <Text x={0} y={300} w={240} align="center" size={12} weight={500} color="var(--ox-fg)" font="body">Medium — 12oz</Text>
    </Group>

    {/* Large Cup */}
    <Group x={640} y={240} name="Large Cup">
      <Box x={0} y={0} w={280} h={300} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 4px 20px rgba(0,0,0,0.06)">
        <Box x={20} y={30} w={240} h={240} radius={4} fill="var(--ox-accent)" opacity={0.06} />
        <Box x={20} y={30} w={240} h={100} radius={0} fill="var(--ox-accent2)" />
        <Box x={100} y={55} w={40} h={40} radius={4} fill="var(--ox-accent)" />
        <Text x={100} y={55} w={40} h={40} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={30} y={115} w={200} align="center" size={10} weight={500} color="var(--ox-accent)" font="body" letterSpacing={2} uppercase>Luxe Café</Text>
      </Box>
      <Text x={0} y={320} w={280} align="center" size={12} weight={500} color="var(--ox-fg)" font="body">Large — 16oz</Text>
    </Group>

    {/* Sleeve Design */}
    <Group x={80} y={600} name="Sleeve">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Cup Sleeve</Text>
      <Box x={0} y={28} w={400} h={140} radius={8} fill="var(--ox-accent2)" opacity={0.1} borderColor="var(--ox-accent2)" borderWidth={1}>
        <Box x={0} y={50} w={400} h={40} fill="var(--ox-accent)" opacity={0.15} />
        <Text x={0} y={58} w={400} align="center" size={16} weight={400} color="var(--ox-accent)" font="display" letterSpacing={4} uppercase>Luxe Café</Text>
        <Text x={0} y={86} w={400} align="center" size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee</Text>
      </Box>
    </Group>

    {/* Paper Bag */}
    <Group x={560} y={600} name="Paper Bag">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Takeaway Bag</Text>
      <Box x={0} y={28} w={320} h={340} radius={4} fill="var(--ox-accent)" opacity={0.04} borderColor="var(--ox-muted)" borderWidth={1}>
        <Box x={40} y={40} w={240} h={80} radius={4} fill="var(--ox-accent)" opacity={0.08} />
        <Box x={120} y={55} w={36} h={36} radius={4} fill="var(--ox-accent)" />
        <Text x={120} y={55} w={36} h={36} align="center" valign="center" size={16} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={40} y={95} w={240} align="center" size={10} weight={400} color="var(--ox-accent)" font="body" letterSpacing={2} uppercase>Luxe Café</Text>
        <Line x={80} y={160} w={160} thickness={1} color="var(--ox-muted)" opacity={0.2} />
        <Text x={40} y={180} w={240} align="center" size={10} weight={400} color="var(--ox-muted)" font="body">Premium coffee &amp; artisanal fare</Text>
      </Box>
    </Group>

    <Line x={80} y={1020} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1040} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Luxe Café — Packaging System</Text>
  </>
);
CoffeeCups.id = 'coffee-cups';
CoffeeCups.label = 'Cups & Bags';

/* ── Scene 2: Loyalty Card ── */
const LoyaltyCard: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={700} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    <Text x={80} y={80} w={600} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Loyalty &amp; Gift
    </Text>
    <Line x={80} y={132} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Loyalty Card */}
    <Group x={80} y={180} name="Loyalty Card">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Loyalty Card</Text>
      <Box x={0} y={28} w={480} h={280} radius={12} fill="var(--ox-accent)" shadow="0 8px 32px rgba(0,0,0,0.1)">
        <Ellipse x={340} y={-60} w={260} h={260} fill="var(--ox-accent2)" opacity={0.1} />
        <Box x={30} y={30} w={36} h={36} radius={4} fill="var(--ox-bg)" opacity={0.2} />
        <Text x={30} y={30} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={80} y={34} w={300} size={18} weight={400} color="var(--ox-bg)" font="display" letterSpacing={2}>Loyalty Card</Text>
        <Text x={30} y={100} w={240} size={10} weight={400} color="var(--ox-bg)" font="body" opacity={0.7}>Collect 10 stamps</Text>
        <Text x={30} y={122} w={240} size={10} weight={400} color="var(--ox-bg)" font="body" opacity={0.7}>Get a free drink</Text>
        {/* Stamp circles */}
        <Ellipse x={30} y={170} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={76} y={170} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={122} y={170} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={168} y={170} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={214} y={170} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={30} y={216} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={76} y={216} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={122} y={216} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={168} y={216} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
        <Ellipse x={214} y={216} w={32} h={32} fill="var(--ox-bg)" opacity={0.15} />
      </Box>
    </Group>

    {/* Gift Card */}
    <Group x={80} y={520} name="Gift Card">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Gift Card</Text>
      <Box x={0} y={28} w={480} h={260} radius={12} fill="var(--ox-accent2)" shadow="0 8px 32px rgba(0,0,0,0.1)">
        <Ellipse x={-60} y={-60} w={260} h={260} fill="var(--ox-accent)" opacity={0.1} />
        <Box x={30} y={30} w={36} h={36} radius={4} fill="var(--ox-accent)" opacity={0.3} />
        <Text x={30} y={30} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={80} y={34} w={300} size={18} weight={400} color="var(--ox-fg)" font="display" letterSpacing={2}>Gift Card</Text>
        <Line x={30} y={110} w={200} thickness={1} color="var(--ox-accent)" opacity={0.3} />
        <Text x={30} y={140} w={300} size={28} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>$50.00</Text>
        <Text x={30} y={180} w={420} size={10} weight={400} color="var(--ox-fg)" font="body" opacity={0.7}>Give the gift of Luxe</Text>
      </Box>
    </Group>

    {/* Sticker */}
    <Group x={640} y={180} name="Stickers">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Stickers</Text>
      <Box x={0} y={28} w={120} h={120} radius={60} fill="var(--ox-accent)" shadow="0 4px 16px rgba(0,0,0,0.08)">
        <Text x={0} y={0} w={120} h={120} align="center" valign="center" size={36} weight={300} color="var(--ox-bg)" font="display">L</Text>
      </Box>
      <Box x={150} y={28} w={120} h={120} radius={12} fill="var(--ox-accent2)" shadow="0 4px 16px rgba(0,0,0,0.08)">
        <Text x={0} y={0} w={120} h={120} align="center" valign="center" size={18} weight={400} color="var(--ox-fg)" font="display" letterSpacing={2}>LX</Text>
      </Box>
      <Box x={0} y={170} w={120} h={120} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 4px 16px rgba(0,0,0,0.08)">
        <Text x={0} y={0} w={120} h={120} align="center" valign="center" size={10} weight={500} color="var(--ox-accent)" font="body" letterSpacing={1} uppercase>Luxe Café</Text>
      </Box>
    </Group>

    <Line x={80} y={1020} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1040} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Luxe Café — Cards &amp; Stickers</Text>
  </>
);
LoyaltyCard.id = 'loyalty-card';
LoyaltyCard.label = 'Loyalty & Gift';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Packaging',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [CoffeeCups, LoyaltyCard] satisfies Scene[];
