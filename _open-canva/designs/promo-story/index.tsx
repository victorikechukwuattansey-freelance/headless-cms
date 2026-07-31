import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, Badge, PhotoArea, PhotoOverlay } from '../../components/restaurant';

const PromoStory: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1920} label="Pizza on a wooden table" />
    <PhotoOverlay x={0} y={1300} w={1080} h={620}>
      <Text x={60} y={60} w={960} size={48} weight={700} color={C.white} font="display">
        Pizza Night
      </Text>
      <Text x={60} y={140} w={960} size={18} weight={500} color={C.white} font="body">
        Every Tuesday · 2-for-1
      </Text>
      <Badge x={60} y={200} text="Order Now" color="gold" />
    </PhotoOverlay>
  </>
);

PromoStory.id = 'promo-story';
PromoStory.label = 'Promo Story';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Promo Story',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [PromoStory] satisfies Scene[];
