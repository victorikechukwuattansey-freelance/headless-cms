import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Business Card ── */
const BusinessCard: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={-80} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    <Text x={80} y={80} w={600} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Marketing Assets
    </Text>
    <Line x={80} y={132} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Business Card */}
    <Group x={80} y={180} name="Business Card">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Business Card</Text>
      <Box x={0} y={28} w={460} h={280} radius={8} fill="var(--ox-accent)" shadow="0 8px 32px rgba(0,0,0,0.1)">
        <Ellipse x={300} y={-40} w={220} h={220} fill="var(--ox-accent2)" opacity={0.08} />
        <Box x={28} y={28} w={36} h={36} radius={4} fill="var(--ox-bg)" opacity={0.15} />
        <Text x={28} y={28} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={76} y={32} w={300} size={14} weight={400} color="var(--ox-bg)" font="display" letterSpacing={3} uppercase>Luxe Café</Text>
        <Line x={28} y={100} w={80} thickness={1} color="var(--ox-bg)" opacity={0.2} />
        <Text x={28} y={120} w={300} size={10} weight={400} color="var(--ox-bg)" font="body" opacity={0.8}>hello@luxecafe.com</Text>
        <Text x={28} y={144} w={300} size={10} weight={400} color="var(--ox-bg)" font="body" opacity={0.8}>@luxecafe</Text>
        <Text x={28} y={168} w={300} size={10} weight={400} color="var(--ox-bg)" font="body" opacity={0.8}>luxecafe.com</Text>
        <Line x={28} y={204} w={200} thickness={1} color="var(--ox-bg)" opacity={0.15} />
        <Text x={28} y={220} w={400} size={9} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} opacity={0.5}>Premium coffee &amp; artisanal fare</Text>
      </Box>
      <Text x={500} y={40} w={460} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Premium matte finish business card with gold foil Luxe mark. Minimal layout with essential contact details.
      </Text>
    </Group>

    {/* Gift Voucher */}
    <Group x={80} y={540} name="Gift Voucher">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Gift Voucher</Text>
      <Box x={0} y={28} w={700} h={220} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-accent2)" borderWidth={1} shadow="0 8px 32px rgba(0,0,0,0.06)">
        <Box x={0} y={0} w={220} h={220} radius={0} fill="var(--ox-accent)" />
        <Ellipse x={-40} y={-40} w={200} h={200} fill="var(--ox-accent2)" opacity={0.1} />
        <Box x={40} y={40} w={48} h={48} radius={6} fill="var(--ox-bg)" opacity={0.15} />
        <Text x={40} y={40} w={48} h={48} align="center" valign="center" size={22} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={30} y={110} w={160} align="center" size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} opacity={0.8}>Gift Voucher</Text>
        <Text x={260} y={40} w={400} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>$25.00</Text>
        <Line x={260} y={90} w={200} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
        <Text x={260} y={110} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">A taste of luxury — redeemable on all</Text>
        <Text x={260} y={132} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">menu items and retail purchases.</Text>
        <Line x={260} y={170} w={400} thickness={1} color="var(--ox-muted)" opacity={0.15} />
        <Text x={260} y={186} w={400} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Luxe Café — Est. 2026</Text>
      </Box>
    </Group>

    {/* Email Signature */}
    <Group x={80} y={820} name="Email Signature">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Email Signature</Text>
      <Box x={0} y={28} w={920} h={100} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Box x={16} y={16} w={32} h={32} radius={4} fill="var(--ox-accent)" />
        <Text x={16} y={16} w={32} h={32} align="center" valign="center" size={16} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={60} y={18} w={300} size={14} weight={500} color="var(--ox-fg)" font="body">Jane Doe</Text>
        <Text x={60} y={38} w={300} size={10} weight={400} color="var(--ox-muted)" font="body">General Manager &middot; Luxe Café</Text>
        <Text x={400} y={18} w={300} size={10} weight={400} color="var(--ox-muted)" font="body">jane@luxecafe.com</Text>
        <Text x={400} y={38} w={300} size={10} weight={400} color="var(--ox-muted)" font="body">luxecafe.com &middot; @luxecafe</Text>
        <Line x={60} y={68} w={200} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
        <Text x={60} y={78} w={400} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={1}>Premium coffee &amp; artisanal fare</Text>
      </Box>
    </Group>
  </>
);
BusinessCard.id = 'marketing';
BusinessCard.label = 'Marketing Assets';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Marketing Assets',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BusinessCard] satisfies Scene[];
