import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, Badge } from '../../components/restaurant';

const HappyHour: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />
    <Group x={0} y={300} name="Content">
      <Text x={0} y={0} w={1080} align="center" size={48} weight={700} color="#fff" font="display" letterSpacing={2}>
        HAPPY HOUR
      </Text>
      <Text x={0} y={70} w={1080} align="center" size={18} weight={400} color="rgba(255,255,255,0.85)" font="body">
        Mon–Fri · 4PM–6PM
      </Text>
    </Group>
    <Group x={0} y={440} name="Badge">
      <Box x={340} y={0} w={400} h={80} radius={40} fill={C.gold}>
        <Text x={0} y={0} w={400} h={80} align="center" valign="center" size={24} weight={700} color={C.charcoal} font="display" letterSpacing={1}>
          50% OFF Drinks
        </Text>
      </Box>
    </Group>
  </>
);

HappyHour.id = 'happy-hour';
HappyHour.label = 'Happy Hour';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [HappyHour] satisfies Scene[];
