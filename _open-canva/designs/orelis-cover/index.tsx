import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const ProductCover: Scene = () => (
  <>
    {/* Background */}
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative background ellipse */}
    <Ellipse x={140} y={140} w={800} h={800} fill="var(--ox-accent)" opacity={0.04} />

    {/* Brand header */}
    <Group x={80} y={48} name="Brand Header">
      <Box x={0} y={0} w={20} h={20} fill="var(--ox-accent2)" />
      <Text x={32} y={0} w={300} size={16} weight={700} color="var(--ox-accent)" font="display" letterSpacing={4} uppercase>
        ORELIS
      </Text>
    </Group>

    {/* Product image placeholder — circular */}
    <Ellipse x={290} y={240} w={500} h={500} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} />
    <Ellipse x={310} y={260} w={460} h={460} fill="var(--ox-muted)" opacity={0.1} />
    <Text x={340} y={470} w={400} align="center" size={14} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Product
    </Text>

    {/* Product title */}
    <Group x={80} y={820} name="Product Info">
      <Line x={0} y={0} w={48} thickness={3} color="var(--ox-accent2)" />
      <Text x={0} y={20} w={920} size={36} weight={600} color="var(--ox-fg)" font="display" letterSpacing={2}>
        Product Name
      </Text>
      <Text x={0} y={68} w={640} size={14} weight={300} color="var(--ox-muted)" font="body" letterSpacing={1}>
        Collection / Category
      </Text>
    </Group>

    {/* Bottom accent line */}
    <Box x={0} y={1070} w={1080} h={10} fill="var(--ox-accent2)" />
  </>
);

ProductCover.id = 'orelis-cover';
ProductCover.label = 'Product Cover';

export const meta: DesignMeta = {
  theme: 'orelis',
  title: 'House of Orelis — Product Cover',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ProductCover] satisfies Scene[];
