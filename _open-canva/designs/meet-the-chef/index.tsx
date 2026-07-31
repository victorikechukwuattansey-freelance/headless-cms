import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={540} h={1080} label="Chef Marco" />
    <Box x={540} y={0} w={540} h={1080} fill={C.white}>
      <Text x={30} y={300} w={480} size={22} italic color={C.terracotta} font="display">
        {"\"Fresh ingredients, simple techniques.\""}
      </Text>
      <Text x={30} y={440} w={480} size={28} weight={700} color={C.charcoal} font="display">
        Chef Marco
      </Text>
      <Text x={30} y={478} w={480} size={16} weight={400} color={C.muted} font="body">
        Head Chef · 12 years
      </Text>
    </Box>
  </>
);

Main.id = 'meet-the-chef';
Main.label = 'Meet the Chef';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Meet the Chef',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
