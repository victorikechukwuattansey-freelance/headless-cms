import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const LimitedOffer: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />
    <Group x={0} y={320} name="Headline">
      <Text x={0} y={0} w={1080} align="center" size={32} weight={700} color="#fff" font="display">
        Limited Offer
      </Text>
      <Text x={0} y={48} w={1080} align="center" size={20} weight={400} color="rgba(255,255,255,0.7)" font="body">
        Ends Sunday
      </Text>
    </Group>
    <Group x={140} y={440} name="Countdown">
      <Box x={0} y={0} w={200} h={200} radius={16} fill={C.cream}>
        <Text x={0} y={0} w={200} h={200} align="center" valign="center" size={64} weight={700} color={C.charcoal} font="display">
          3
        </Text>
      </Box>
      <Box x={280} y={0} w={200} h={200} radius={16} fill={C.cream}>
        <Text x={0} y={0} w={200} h={200} align="center" valign="center" size={64} weight={700} color={C.charcoal} font="display">
          2
        </Text>
      </Box>
      <Box x={560} y={0} w={200} h={200} radius={16} fill={C.cream}>
        <Text x={0} y={0} w={200} h={200} align="center" valign="center" size={64} weight={700} color={C.charcoal} font="display">
          1
        </Text>
      </Box>
    </Group>
    <Text x={0} y={670} w={1080} align="center" size={18} weight={500} color="rgba(255,255,255,0.6)" font="body">
      days left
    </Text>
  </>
);

LimitedOffer.id = 'limited-offer';
LimitedOffer.label = 'Limited Offer';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [LimitedOffer] satisfies Scene[];
