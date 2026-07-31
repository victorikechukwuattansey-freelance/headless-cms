import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, Divider } from '../../components/restaurant';

const SeasonalMenu: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={540} label="Spring vegetables and herbs" />

    <Box x={0} y={540} w={1080} h={540} fill={C.white}>
      <Text x={60} y={60} w={960} size={26} weight={700} color={C.charcoal} font="display">
        Introducing Spring Menu
      </Text>

      <Divider x={60} y={112} w={160} color={C.olive} />

      <Text x={60} y={148} w={960} size={15} weight={500} color={C.muted} font="body">
        Seasonal · Farm-fresh · New flavours
      </Text>
    </Box>
  </>
);

SeasonalMenu.id = 'seasonal-menu-launch';
SeasonalMenu.label = 'Seasonal Menu Launch';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Seasonal Menu Launch',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [SeasonalMenu] satisfies Scene[];
