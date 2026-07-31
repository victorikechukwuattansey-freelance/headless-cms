import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const GuidelinesCover: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-accent)" />

    {/* Decorative */}
    <Ellipse x={-200} y={-200} w={600} h={600} fill="var(--ox-bg)" opacity={0.03} />
    <Ellipse x={600} y={1200} w={700} h={700} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Content */}
    <Group x={80} y={400} name="Cover Content">
      <Box x={0} y={0} w={80} h={80} radius={8} fill="var(--ox-bg)" opacity={0.1} />
      <Text x={0} y={0} w={80} h={80} align="center" valign="center" size={36} weight={300} color="var(--ox-bg)" font="display">L</Text>
      <Text x={120} y={12} w={800} size={64} weight={300} color="var(--ox-bg)" font="display" letterSpacing={4} uppercase>
        Brand
      </Text>
      <Text x={120} y={96} w={800} size={52} weight={300} color="var(--ox-accent2)" font="display" letterSpacing={6} uppercase>
        Guidelines
      </Text>
      <Line x={120} y={176} w={100} thickness={2} color="var(--ox-accent2)" opacity={0.7} />
      <Text x={120} y={220} w={600} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.8}>
        A comprehensive guide to the Luxe Café visual identity system.
      </Text>
      <Text x={120} y={300} w={600} size={12} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} opacity={0.5} uppercase>
        Version 1.0 &middot; 2026
      </Text>
    </Group>

    {/* Table of contents */}
    <Group x={80} y={800} name="TOC">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Contents</Text>
      <Line x={0} y={20} w={400} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
      <Text x={0} y={44} w={400} size={13} weight={400} color="var(--ox-bg)" font="body" lineHeight={2.4} opacity={0.85}>
        01 &nbsp; Brand Story &amp; Positioning{'\n'}
        02 &nbsp; Logo System &amp; Usage{'\n'}
        03 &nbsp; Color Palette{'\n'}
        04 &nbsp; Typography{'\n'}
        05 &nbsp; Graphic Elements{'\n'}
        06 &nbsp; Menu Design{'\n'}
        07 &nbsp; Packaging{'\n'}
        08 &nbsp; Storefront{'\n'}
        09 &nbsp; Social Media{'\n'}
        10 &nbsp; Marketing Collateral{'\n'}
        11 &nbsp; Photography &amp; Imagery{'\n'}
        12 &nbsp; Accessibility &amp; Standards
      </Text>
    </Group>

    <Line x={80} y={1840} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1860} w={600} size={10} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} opacity={0.5}>Luxe Café — Brand Guidelines</Text>
  </>
);
GuidelinesCover.id = 'guidelines';
GuidelinesCover.label = 'Guidelines';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Brand Guidelines',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [GuidelinesCover] satisfies Scene[];
