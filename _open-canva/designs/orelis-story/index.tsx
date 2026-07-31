import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const Story: Scene = () => (
  <>
    {/* Full background */}
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-bg)" />

    {/* Top brand element */}
    <Group x={0} y={0} name="Brand Bar">
      <Box x={0} y={0} w={1080} h={6} fill="var(--ox-accent2)" />
      <Group x={480} y={40} name="Logo">
        <Box x={0} y={0} w={28} h={28} fill="var(--ox-accent)" />
        <Box x={6} y={6} w={16} h={16} fill="var(--ox-accent2)" />
      </Group>
    </Group>

    {/* Main headline area */}
    <Group x={80} y={320} name="Headline">
      <Line x={0} y={0} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={28} w={920} size={72} weight={700} color="var(--ox-fg)" font="display" letterSpacing={4} uppercase>
        New
      </Text>
      <Text x={0} y={120} w={920} size={48} weight={400} color="var(--ox-accent)" font="display" letterSpacing={6} uppercase>
        Collection
      </Text>

      <Line x={0} y={200} w={200} thickness={1} color="var(--ox-muted)" opacity={0.4} />

      <Text x={0} y={228} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6} letterSpacing={1}>
        Elevate your style with our latest curated pieces. Discover the art of refined elegance.
      </Text>
    </Group>

    {/* Product image placeholder */}
    <Box x={80} y={600} w={920} h={800} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={380} w={920} align="center" size={14} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product Visual
      </Text>
      <Line x={400} y={420} w={280} thickness={1} color="var(--ox-muted)" opacity={0.4} />
    </Box>

    {/* CTA */}
    <Box x={80} y={1480} w={920} h={60} fill="var(--ox-accent)" radius={0}>
      <Text x={0} y={0} w={920} h={60} align="center" valign="center" size={14} weight={600} color="var(--ox-bg)" font="body" letterSpacing={3} uppercase>
        Shop Now
      </Text>
    </Box>

    {/* Bottom bar */}
    <Box x={0} y={1914} w={1080} h={6} fill="var(--ox-accent)" />
  </>
);

Story.id = 'orelis-story';
Story.label = 'Story';

export const meta: DesignMeta = {
  theme: 'orelis',
  title: 'House of Orelis — Story Template',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [Story] satisfies Scene[];
