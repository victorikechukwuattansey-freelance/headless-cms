import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const FreeDelivery: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="#fff" />
    <Group x={0} y={360} name="Content">
      <Text x={0} y={0} w={1080} align="center" size={64}>
        🚚
      </Text>
      <Text x={0} y={90} w={1080} align="center" size={26} weight={700} color={C.charcoal} font="display">
        Free Delivery
      </Text>
      <Text x={0} y={140} w={1080} align="center" size={14} weight={400} color={C.muted} font="body" lineHeight={1.6}>
        {'On orders over $25\nWithin 5km radius'}
      </Text>
    </Group>
  </>
);

FreeDelivery.id = 'free-delivery';
FreeDelivery.label = 'Free Delivery';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [FreeDelivery] satisfies Scene[];
