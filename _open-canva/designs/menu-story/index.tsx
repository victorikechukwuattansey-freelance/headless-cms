import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, PriceTag } from '../../components/restaurant';

const MenuStory: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1248} label="Caesar salad on a plate" />
    <Box x={0} y={1248} w={1080} h={672} fill={C.white}>
      <Text x={60} y={48} w={960} size={32} weight={700} color={C.charcoal} font="display">
        Caesar Salad
      </Text>
      <Text x={60} y={104} w={960} size={14} weight={400} color={C.muted} font="body">
        Romaine · Parmesan · Croutons
      </Text>
      <PriceTag x={60} y={156} price="$14" />
      <Text x={60} y={220} w={960} size={14} weight={600} color={C.terracotta} font="body">
        Order Now →
      </Text>
    </Box>
  </>
);

MenuStory.id = 'menu-story';
MenuStory.label = 'Menu Story';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Menu Story',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [MenuStory] satisfies Scene[];
