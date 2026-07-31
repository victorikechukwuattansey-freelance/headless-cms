import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const DrinkSpecial: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill={C.charcoal} />
    <Group x={80} y={240} name="DrinkLeft">
      <Text x={0} y={0} w={480} size={56} weight={700} color="var(--ox-bg)" font="display" rotate={-5}>
        Summer
      </Text>
      <Text x={0} y={80} w={480} size={48} weight={700} color="var(--ox-accent2)" font="display" rotate={-5}>
        Spritz
      </Text>
      <Text x={0} y={200} w={480} size={16} weight={400} color="var(--ox-muted)" font="body">
        Aperol · Prosecco · Soda · Orange
      </Text>
      <PriceTag x={0} y={270} price="$12.00" />
    </Group>
    <PhotoArea x={594} y={0} w={486} h={1080} label="🍹" />
  </>
);

DrinkSpecial.id = 'drink-special';
DrinkSpecial.label = 'Drink Special';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DrinkSpecial] satisfies Scene[];
