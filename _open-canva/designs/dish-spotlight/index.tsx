import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const DishSpotlight: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={540} h={1080} label="📷" />
    <Group x={600} y={280} name="DishInfo">
      <Text x={0} y={0} w={440} size={36} weight={700} color="var(--ox-fg)" font="display">
        Grilled Salmon
      </Text>
      <Text x={0} y={60} w={420} size={16} weight={400} color="var(--ox-muted)" font="body">
        Atlantic salmon fillet with roasted asparagus, cherry tomatoes, and lemon-herb butter sauce.
      </Text>
      <PriceTag x={0} y={160} price="$24.95" />
    </Group>
  </>
);

DishSpotlight.id = 'dish-spotlight';
DishSpotlight.label = 'Dish Spotlight';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DishSpotlight] satisfies Scene[];
