import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, Divider } from '../../components/restaurant';

const HoursStory: Scene = () => (
  <Box x={0} y={0} w={1080} h={1920} fill={C.charcoal}>
    <Text x={0} y={600} w={1080} align="center" size={44} weight={700} color={C.white} font="display">
      Open Today
    </Text>
    <Text x={0} y={680} w={1080} align="center" size={24} weight={500} color={C.white} font="body">
      11:00 AM – 10:00 PM
    </Text>
    <Text x={0} y={730} w={1080} align="center" size={16} weight={400} color={C.white} font="body" opacity={0.6}>
      Kitchen closes at 9:30 PM
    </Text>
    <Divider x={270} y={800} w={540} color={C.gold} />
    <Text x={0} y={860} w={1080} align="center" size={20} weight={500} color={C.white} font="body">
      See you soon! 🍽️
    </Text>
  </Box>
);

HoursStory.id = 'hours-story';
HoursStory.label = 'Hours Story';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Hours Story',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [HoursStory] satisfies Scene[];
