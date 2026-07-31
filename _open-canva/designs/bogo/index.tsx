import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const Bogo: Scene = () => (
  <>
    <Box x={0} y={0} w={540} h={1080} fill={C.cream} />
    <Box x={540} y={0} w={540} h={1080} fill={C.olive} />
    <Group x={0} y={0} w={540} h={1080} name="Left">
      <Text x={0} y={380} w={540} align="center" size={40} weight={700} color={C.terracotta} font="display">
        BUY 1
      </Text>
      <Text x={0} y={440} w={540} align="center" size={24} weight={500} color={C.charcoal} font="body">
        Burger
      </Text>
    </Group>
    <Group x={540} y={0} w={540} h={1080} name="Right">
      <Text x={0} y={380} w={540} align="center" size={40} weight={700} color="#fff" font="display">
        GET 1
      </Text>
      <Text x={0} y={440} w={540} align="center" size={24} weight={500} color="#fff" font="body">
        Free
      </Text>
    </Group>
  </>
);

Bogo.id = 'bogo';
Bogo.label = 'BOGO Deal';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Bogo] satisfies Scene[];
