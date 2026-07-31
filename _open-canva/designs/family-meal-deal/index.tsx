import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, Badge, PhotoOverlay } from '../../components/restaurant';

const FamilyMealDeal: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="Family Feast Photo" />
    <Group x={40} y={40} name="Badge">
      <Box x={0} y={0} w={120} h={40} radius={20} fill={C.olive}>
        <Text x={0} y={0} w={120} h={40} align="center" valign="center" size={12} weight={700} color="#fff" font="body" letterSpacing={0.5}>
          Feeds 4
        </Text>
      </Box>
    </Group>
    <PhotoOverlay x={0} y={700} w={1080} h={380}>
      <Group x={60} y={60} name="DealInfo">
        <Text x={0} y={0} w={960} size={30} weight={700} color="#fff" font="display">
          Family Feast
        </Text>
        <Text x={0} y={50} w={960} size={18} weight={400} color="rgba(255,255,255,0.9)" font="body">
          2 mains · 2 sides · 4 drinks · $49
        </Text>
      </Group>
    </PhotoOverlay>
  </>
);

FamilyMealDeal.id = 'family-meal-deal';
FamilyMealDeal.label = 'Family Meal Deal';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [FamilyMealDeal] satisfies Scene[];
