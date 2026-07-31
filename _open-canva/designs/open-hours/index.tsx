import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HoursRow } from '../../components/restaurant';

const OpenHours: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.white}>
    <Text x={0} y={120} w={1080} align="center" size={28} weight={700} color={C.charcoal} font="display">
      Hours
    </Text>
    <HoursRow x={280} y={240} day="Mon–Thu" time="11AM–10PM" />
    <HoursRow x={280} y={290} day="Fri–Sat" time="11AM–11PM" />
    <HoursRow x={280} y={340} day="Sun" time="10AM–8PM" />
  </Box>
);

OpenHours.id = 'open-hours';
OpenHours.label = 'Open Hours';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Open Hours',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [OpenHours] satisfies Scene[];
