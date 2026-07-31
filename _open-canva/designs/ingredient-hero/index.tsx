import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const IngredientHero: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Group x={0} y={320} name="Ingredient">
      <Text x={0} y={0} w={1080} size={120} align="center" font="body">
        🍅
      </Text>
      <Text x={0} y={130} w={1080} size={28} weight={700} align="center" color="var(--ox-fg)" font="display">
        San Marzano Tomatoes
      </Text>
      <Text x={240} y={180} w={600} size={14} weight={400} align="center" color="var(--ox-muted)" font="body">
        Sun-ripened in the volcanic soil of Mount Vesuvius.
      </Text>
    </Group>
  </>
);

IngredientHero.id = 'ingredient-hero';
IngredientHero.label = 'Ingredient Hero';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [IngredientHero] satisfies Scene[];
