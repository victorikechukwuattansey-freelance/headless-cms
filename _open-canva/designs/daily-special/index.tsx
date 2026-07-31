import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const DailySpecial: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={540} label="📷 Today's Feature" />
    <Box x={0} y={540} w={1080} h={540} fill="#ffffff" />
    <Badge x={80} y={580} text="TODAY'S SPECIAL" color="terracotta" />
    <Group x={80} y={640} name="SpecialInfo">
      <Text x={0} y={0} w={920} size={32} weight={700} color="var(--ox-fg)" font="display">
        Pan-Seared Sea Bass
      </Text>
      <Text x={0} y={56} w={860} size={16} weight={400} color="var(--ox-muted)" font="body">
        Fresh sea bass with saffron risotto, grilled vegetables, and caper beurre blanc.
      </Text>
      <PriceTag x={0} y={130} price="$29.95" />
    </Group>
  </>
);

DailySpecial.id = 'daily-special';
DailySpecial.label = 'Daily Special';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DailySpecial] satisfies Scene[];
