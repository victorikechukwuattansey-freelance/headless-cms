import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const DeliveryInfo: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.white}>
    <Text x={0} y={300} w={1080} align="center" size={48} color={C.charcoal} font="body">
      🛵
    </Text>
    <Text x={0} y={380} w={1080} align="center" size={22} weight={700} color={C.charcoal} font="body">
      Delivery Zone
    </Text>
    <Text x={0} y={430} w={1080} align="center" size={14} weight={400} color={C.muted} font="body">
      Within 5km · Min. $20{'\n'}Free delivery over $30
    </Text>
    <Text x={0} y={510} w={1080} align="center" size={16} weight={600} color={C.terracotta} font="body">
      ETA: 30–45 min
    </Text>
  </Box>
);

DeliveryInfo.id = 'delivery-info';
DeliveryInfo.label = 'Delivery Info';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Delivery Info',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [DeliveryInfo] satisfies Scene[];
