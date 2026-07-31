import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const ComboDeal: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Group x={36} y={40} name="PhotoStrip">
      <PhotoArea x={0} y={0} w={328} h={400} label="🍔" />
      <Text x={358} y={180} w={24} size={28} weight={700} align="center" color="var(--ox-accent)" font="display">
        +
      </Text>
      <PhotoArea x={376} y={0} w={328} h={400} label="🍟" />
      <Text x={698} y={180} w={24} size={28} weight={700} align="center" color="var(--ox-accent)" font="display">
        +
      </Text>
      <PhotoArea x={716} y={0} w={328} h={400} label="🥤" />
    </Group>
    <Box x={0} y={480} w={1080} h={140} fill="#ffffff" />
    <Group x={60} y={500} name="ComboInfo">
      <Text x={0} y={0} w={400} size={28} weight={700} color="var(--ox-fg)" font="display">
        Combo Meal
      </Text>
      <Text x={0} y={44} w={500} size={14} weight={400} color="var(--ox-muted)" font="body">
        Burger · Fries · Drink — choose any size
      </Text>
      <PriceTag x={0} y={80} price="$15.99" />
    </Group>
  </>
);

ComboDeal.id = 'combo-deal';
ComboDeal.label = 'Combo Deal';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ComboDeal] satisfies Scene[];
