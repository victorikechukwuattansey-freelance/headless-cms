import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, Badge } from '../../components/restaurant';

const Valentines: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="linear-gradient(135deg, #fce4ec, #f8bbd0)">
      <PhotoArea x={0} y={0} w={1080} h={1080} label="Romantic candlelit dinner" />
    </Box>

    <Box x={0} y={780} w={1080} h={300} fill="linear-gradient(0deg, rgba(200,50,50,0.8), transparent)">
      <Text x={60} y={48} w={960} size={28} weight={700} color={C.white} font="display">
        Valentine's Dinner
      </Text>
      <Text x={60} y={96} w={960} size={16} weight={500} color={C.white} font="body">
        Feb 14 · Reserve your table
      </Text>
    </Box>
  </>
);

Valentines.id = 'valentines-dinner';
Valentines.label = "Valentine's Dinner";

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: "Valentine's Dinner",
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Valentines] satisfies Scene[];
