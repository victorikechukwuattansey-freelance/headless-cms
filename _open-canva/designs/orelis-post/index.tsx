import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const InstagramPost: Scene = () => (
  <>
    {/* Background */}
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Top brand bar */}
    <Group x={0} y={0} name="Brand Bar">
      <Box x={0} y={0} w={1080} h={80} fill="var(--ox-accent)" />
      <Box x={32} y={20} w={24} h={24} fill="var(--ox-accent2)" />
      <Text x={68} y={20} w={300} size={20} weight={700} color="var(--ox-bg)" font="display" letterSpacing={4} uppercase>
        ORELIS
      </Text>
    </Group>

    {/* Product image placeholder */}
    <Box x={80} y={120} w={920} h={580} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={260} w={920} align="center" size={16} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product Image
      </Text>
      <Line x={400} y={300} w={280} thickness={1} color="var(--ox-muted)" opacity={0.4} />
    </Box>

    {/* Bottom content */}
    <Group x={80} y={740} name="Content">
      {/* Decorative line */}
      <Line x={0} y={0} w={60} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={24} w={920} size={32} weight={600} color="var(--ox-fg)" font="display" letterSpacing={2}>
        Title goes here
      </Text>
      <Text x={0} y={72} w={640} size={16} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.5}>
        Description text that introduces the collection piece and creates desire through refined storytelling.
      </Text>
    </Group>

    {/* Bottom brand line */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={998} w={920} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      House of Orelis
    </Text>
  </>
);

InstagramPost.id = 'orelis-post';
InstagramPost.label = 'Instagram Post';

export const meta: DesignMeta = {
  theme: 'orelis',
  title: 'House of Orelis — Instagram Post',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [InstagramPost] satisfies Scene[];
