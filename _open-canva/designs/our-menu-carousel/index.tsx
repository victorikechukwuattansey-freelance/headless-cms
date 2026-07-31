import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const OurMenuCarousel: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Group x={0} y={200} name="CarouselHeader">
      <Text x={0} y={0} w={1080} size={40} weight={700} align="center" color="var(--ox-fg)" font="display">
        Our Menu
      </Text>
      <Line x={324} y={72} w={432} thickness={2} color={C.gold} />
      <Text x={0} y={120} w={1080} size={18} weight={400} align="center" color="var(--ox-muted)" font="body">
        Swipe to explore →
      </Text>
    </Group>
    <Group x={400} y={960} name="Dots">
      <Ellipse x={0} y={0} w={12} h={12} fill={C.terracotta} />
      <Ellipse x={24} y={0} w={12} h={12} fill={C.gold} opacity={0.5} />
      <Ellipse x={48} y={0} w={12} h={12} fill={C.gold} opacity={0.5} />
      <Ellipse x={72} y={0} w={12} h={12} fill={C.gold} opacity={0.5} />
    </Group>
  </>
);

OurMenuCarousel.id = 'our-menu-carousel';
OurMenuCarousel.label = 'Our Menu Carousel';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [OurMenuCarousel] satisfies Scene[];
