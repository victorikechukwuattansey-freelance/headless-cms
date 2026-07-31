import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Storefront Signage ── */
const StorefrontSignage: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={-80} w={400} h={400} fill="var(--ox-accent)" opacity={0.04} />

    <Text x={80} y={80} w={600} size={36} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Storefront
    </Text>
    <Line x={80} y={132} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Exterior Sign */}
    <Group x={80} y={180} name="Exterior Sign">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Exterior Signage</Text>
      <Box x={0} y={28} w={920} h={240} radius={8} fill="var(--ox-accent)" shadow="0 8px 32px rgba(0,0,0,0.12)">
        <Ellipse x={700} y={-60} w={300} h={300} fill="var(--ox-accent2)" opacity={0.08} />
        <Box x={40} y={40} w={60} h={60} radius={6} fill="var(--ox-bg)" opacity={0.15} />
        <Text x={40} y={40} w={60} h={60} align="center" valign="center" size={28} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={120} y={48} w={600} size={40} weight={300} color="var(--ox-bg)" font="display" letterSpacing={6} uppercase>Luxe Café</Text>
        <Text x={120} y={104} w={600} size={14} weight={400} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>Premium coffee &amp; artisanal fare</Text>
        <Line x={40} y={160} w={200} thickness={1} color="var(--ox-bg)" opacity={0.2} />
        <Text x={40} y={180} w={400} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} opacity={0.6}>Est. 2026</Text>
      </Box>
    </Group>

    {/* Hanging Sign */}
    <Group x={80} y={480} name="Hanging Sign">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Hanging Sign</Text>
      <Line x={200} y={8} w={2} thickness={16} color="var(--ox-muted)" opacity={0.3} />
      <Box x={60} y={40} w={280} h={280} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-accent)" borderWidth={2} shadow="0 8px 32px rgba(0,0,0,0.1)">
        <Box x={60} y={60} w={48} h={48} radius={6} fill="var(--ox-accent)" />
        <Text x={60} y={60} w={48} h={48} align="center" valign="center" size={22} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={30} y={130} w={220} align="center" size={24} weight={400} color="var(--ox-accent)" font="display" letterSpacing={4} uppercase>Luxe</Text>
        <Text x={30} y={170} w={220} align="center" size={14} weight={400} color="var(--ox-accent)" font="display" letterSpacing={3} uppercase>Café</Text>
        <Line x={70} y={200} w={140} thickness={1} color="var(--ox-accent2)" opacity={0.4} />
        <Text x={30} y={220} w={220} align="center" size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Since 2026</Text>
      </Box>
      <Text x={400} y={80} w={460} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Wall-mounted hanging sign with illuminated edge detailing. Matte black finish with brass accents.
      </Text>
      <Text x={400} y={140} w={460} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Dimensions: 24" × 24" · Material: Powder-coated aluminium · Illumination: Warm LED backlight
      </Text>
    </Group>

    {/* Window Graphic */}
    <Group x={80} y={700} name="Window Graphic">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Window Graphic</Text>
      <Box x={0} y={28} w={400} h={200} radius={4} fill="var(--ox-accent)" opacity={0.04} borderColor="var(--ox-muted)" borderWidth={1} style={{ borderStyle: 'dashed' }}>
        <Text x={0} y={50} w={400} align="center" size={22} weight={300} color="var(--ox-accent)" font="display" letterSpacing={4} uppercase>Luxe Café</Text>
        <Text x={0} y={90} w={400} align="center" size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee</Text>
        <Line x={100} y={120} w={200} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
        <Text x={0} y={140} w={400} align="center" size={13} weight={300} color="var(--ox-muted)" font="body">Mon — Fri &middot; 7am — 7pm</Text>
        <Text x={0} y={162} w={400} align="center" size={13} weight={300} color="var(--ox-muted)" font="body">Sat — Sun &middot; 8am — 6pm</Text>
      </Box>
      <Text x={440} y={40} w={500} size={12} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Frosted vinyl window decal with gold foil accent lettering. Centered on floor-to-ceiling glass.
      </Text>
    </Group>

    <Line x={80} y={1020} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1040} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Luxe Café — Storefront Design</Text>
  </>
);
StorefrontSignage.id = 'storefront';
StorefrontSignage.label = 'Storefront';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Storefront',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [StorefrontSignage] satisfies Scene[];
