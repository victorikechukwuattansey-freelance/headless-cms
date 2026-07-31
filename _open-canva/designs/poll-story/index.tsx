import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea } from '../../components/restaurant';

const PollStory: Scene = () => (
  <Box x={0} y={0} w={1080} h={1920} fill={C.cream}>
    <Text x={0} y={80} w={1080} align="center" size={32} weight={700} color={C.charcoal} font="body">
      THIS or THAT?
    </Text>
    <PhotoArea x={60} y={200} w={440} h={600} label="🍝 Pasta" radius={12} />
    <PhotoArea x={580} y={200} w={440} h={600} label="🍕 Pizza" radius={12} />
    <Box x={60} y={860} w={440} h={48} radius={8} fill={C.cream} borderColor={C.terracotta} borderWidth={2}>
      <Text x={0} y={0} w={440} h={48} align="center" valign="center" size={14} weight={600} color={C.terracotta} font="body">
        Pasta
      </Text>
    </Box>
    <Box x={580} y={860} w={440} h={48} radius={8} fill={C.cream} borderColor={C.olive} borderWidth={2}>
      <Text x={0} y={0} w={440} h={48} align="center" valign="center" size={14} weight={600} color={C.olive} font="body">
        Pizza
      </Text>
    </Box>
  </Box>
);

PollStory.id = 'poll-story';
PollStory.label = 'Poll Story';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Poll Story',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [PollStory] satisfies Scene[];
