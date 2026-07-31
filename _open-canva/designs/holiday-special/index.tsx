import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, Divider } from '../../components/restaurant';

const Holiday: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill="#cc3333">
    <Text x={0} y={60} w={1080} align="center" size={40} weight={700} color={C.gold} font="display">
      Christmas
    </Text>

    <Text x={0} y={160} w={1080} align="center" size={16} weight={600} color={C.white} font="body">
      Special Holiday Menu
    </Text>

    <Text x={0} y={196} w={1080} align="center" size={14} weight={500} color={C.gold} font="body">
      Dec 24–26 · Reserve now
    </Text>
  </Box>
);

Holiday.id = 'holiday-special';
Holiday.label = 'Holiday Special';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Holiday Special',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Holiday] satisfies Scene[];
