import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, PhotoOverlay } from '../../components/restaurant';

const Brunch: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="Brunch spread on table" />

    <PhotoOverlay x={0} y={780} w={1080} h={300}>
      <Text x={60} y={48} w={960} size={28} weight={700} color={C.white} font="display">
        Weekend Brunch
      </Text>
      <Text x={60} y={96} w={960} size={16} weight={500} color={C.white} font="body">
        Sat–Sun · 9AM–2PM
      </Text>
    </PhotoOverlay>
  </>
);

Brunch.id = 'weekend-brunch';
Brunch.label = 'Weekend Brunch';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Weekend Brunch',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Brunch] satisfies Scene[];
