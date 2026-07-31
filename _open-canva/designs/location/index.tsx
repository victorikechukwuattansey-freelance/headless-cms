import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea } from '../../components/restaurant';

const Location: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.white}>
    <PhotoArea x={0} y={0} w={1080} h={600} label="Map location" />
    <Text x={60} y={680} w={960} size={22} weight={700} color={C.charcoal} font="body">
      Visit Us
    </Text>
    <Text x={60} y={720} w={960} size={16} weight={400} color={C.muted} font="body">
      123 High Street{'\n'}Manchester, M1 1AA
    </Text>
  </Box>
);

Location.id = 'location';
Location.label = 'Location';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Location',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Location] satisfies Scene[];
