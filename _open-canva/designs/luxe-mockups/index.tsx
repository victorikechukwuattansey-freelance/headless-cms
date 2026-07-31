import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Device Mockups ── */
const DeviceMockups: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={-80} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    <Text x={80} y={80} w={600} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Mockups
    </Text>
    <Line x={80} y={132} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Laptop Mockup */}
    <Group x={80} y={180} name="Laptop">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Laptop Screen</Text>
      <Box x={0} y={28} w={460} h={320} radius={8} fill="var(--ox-accent)" opacity={0.04} borderColor="var(--ox-muted)" borderWidth={1}>
        <Box x={0} y={0} w={460} h={240} radius={0} fill="var(--ox-accent)" opacity={0.06} />
        <Box x={20} y={20} w={32} h={32} radius={4} fill="var(--ox-accent)" opacity={0.6} />
        <Text x={20} y={20} w={32} h={32} align="center" valign="center" size={16} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={68} y={28} w={300} size={18} weight={400} color="var(--ox-fg)" font="display" letterSpacing={2}>Luxe Café</Text>
        <Text x={20} y={80} w={400} size={13} weight={400} color="var(--ox-muted)" font="body">Premium coffee &amp; artisanal fare</Text>
        <Line x={20} y={120} w={100} thickness={1} color="var(--ox-accent2)" opacity={0.4} />
        <Text x={20} y={140} w={200} size={11} weight={400} color="var(--ox-muted)" font="body">luxecafe.com</Text>
      </Box>
      {/* Laptop base */}
      <Box x={120} y={348} w={220} h={16} radius={0} fill="var(--ox-muted)" opacity={0.2} />
      <Box x={100} y={364} w={260} h={8} radius={0} fill="var(--ox-muted)" opacity={0.15} />
      <Text x={0} y={400} w={460} align="center" size={11} weight={400} color="var(--ox-muted)" font="body">Laptop — Website preview</Text>
    </Group>

    {/* Mobile Mockup */}
    <Group x={600} y={180} name="Mobile">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Mobile Screen</Text>
      {/* Phone body */}
      <Box x={120} y={28} w={160} h={320} radius={20} fill="var(--ox-fg)" shadow="0 8px 32px rgba(0,0,0,0.15)">
        <Box x={8} y={8} w={144} h={304} radius={16} fill="var(--ox-bg)" />
        <Box x={8} y={8} w={144} h={80} radius={0} fill="var(--ox-accent)" />
        <Box x={40} y={24} w={24} h={24} radius={4} fill="var(--ox-bg)" opacity={0.2} />
        <Text x={40} y={24} w={24} h={24} align="center" valign="center" size={12} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={20} y={56} w={120} align="center" size={9} weight={400} color="var(--ox-bg)" font="body" letterSpacing={1} uppercase>Luxe Café</Text>
        <Text x={20} y={110} w={120} align="center" size={14} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>Menu</Text>
        <Line x={40} y={140} w={80} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
        <Text x={20} y={160} w={120} align="center" size={8} weight={400} color="var(--ox-muted)" font="body">Flat White</Text>
        <Text x={20} y={176} w={120} align="center" size={8} weight={400} color="var(--ox-muted)" font="body">Latte</Text>
        <Text x={20} y={192} w={120} align="center" size={8} weight={400} color="var(--ox-muted)" font="body">Cold Brew</Text>
      </Box>
      <Text x={0} y={380} w={400} align="center" size={11} weight={400} color="var(--ox-muted)" font="body">Mobile — Menu preview</Text>
    </Group>

    {/* Apron Mockup */}
    <Group x={80} y={560} name="Apron">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Staff Apron</Text>
      <Box x={80} y={28} w={220} h={320} radius={4} fill="var(--ox-accent)" opacity={0.06} borderColor="var(--ox-muted)" borderWidth={1}>
        <Box x={20} y={40} w={180} h={60} radius={4} fill="var(--ox-accent)" opacity={0.8} />
        <Text x={60} y={50} w={100} align="center" size={14} weight={400} color="var(--ox-bg)" font="display" letterSpacing={2}>Luxe</Text>
        <Text x={60} y={70} w={100} align="center" size={9} weight={400} color="var(--ox-bg)" font="body" letterSpacing={1}>Café</Text>
        <Line x={20} y={120} w={180} thickness={1} color="var(--ox-muted)" opacity={0.15} />
      </Box>
      <Text x={340} y={40} w={500} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Premium apron with embroidered Luxe Café logo on chest. Available in espresso brown and ivory.
      </Text>
    </Group>

    {/* Cup in hand */}
    <Group x={80} y={740} name="Coffee Cup Hand">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Coffee Cup</Text>
      <Box x={40} y={28} w={120} h={160} radius={8} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 4px 16px rgba(0,0,0,0.06)">
        <Box x={10} y={15} w={100} h={50} radius={0} fill="var(--ox-accent)" />
        <Box x={25} y={24} w={24} h={24} radius={4} fill="var(--ox-bg)" opacity={0.2} />
        <Text x={25} y={24} w={24} h={24} align="center" valign="center" size={12} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={10} y={50} w={100} align="center" size={7} weight={400} color="var(--ox-bg)" font="body" letterSpacing={1} uppercase>Luxe Café</Text>
      </Box>
      <Box x={30} y={188} w={140} h={20} radius={4} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={0} w={140} h={20} align="center" valign="center" size={8} weight={400} color="var(--ox-muted)" font="body">Cup sleeve</Text>
      </Box>
      <Text x={200} y={60} w={500} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        12oz takeaway cup with Luxe Café branding. Double-wall insulation with custom sleeve.
      </Text>
    </Group>

    <Line x={80} y={1020} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1040} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Luxe Café — Presentation Mockups</Text>
  </>
);
DeviceMockups.id = 'mockups';
DeviceMockups.label = 'Mockups';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Mockups',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DeviceMockups] satisfies Scene[];
