import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, PhotoOverlay, Badge } from '../../components/restaurant';

const LiveMusic: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="Jazz band on stage" />

    <PhotoOverlay x={0} y={780} w={1080} h={300}>
      <Text x={60} y={48} w={960} size={28} weight={700} color={C.white} font="display">
        Live Jazz Night
      </Text>
      <Text x={60} y={96} w={960} size={16} weight={500} color={C.white} font="body">
        Every Friday · 7PM–10PM
      </Text>
    </PhotoOverlay>

    <Badge x={810} y={60} text="Book a Table" color="gold" />
  </>
);

LiveMusic.id = 'live-music-night';
LiveMusic.label = 'Live Music Night';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Live Music Night',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [LiveMusic] satisfies Scene[];
