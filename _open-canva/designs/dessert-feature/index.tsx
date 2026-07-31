import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const DessertFeature: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill={C.charcoal} />
    <Group x={0} y={280} name="Dessert">
      <PhotoArea x={490} y={0} w={100} h={100} radius={50} label="🍰" />
      <Text x={0} y={130} w={1080} size={32} weight={700} align="center" color="var(--ox-bg)" font="display">
        Tiramisu
      </Text>
      <Text x={240} y={190} w={600} size={16} weight={400} align="center" color="var(--ox-muted)" font="body">
        Espresso-soaked ladyfingers with mascarpone cream and cocoa dust.
      </Text>
      <PriceTag x={501} y={260} price="$9.95" />
    </Group>
  </>
);

DessertFeature.id = 'dessert-feature';
DessertFeature.label = 'Dessert Feature';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DessertFeature] satisfies Scene[];
