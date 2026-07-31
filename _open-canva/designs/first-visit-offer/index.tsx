import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const FirstVisitOffer: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />
    <Group x={0} y={320} name="Headline">
      <Text x={0} y={0} w={1080} align="center" size={28} weight={400} color="#fff" font="display" italic>
        First time?
      </Text>
      <Text x={0} y={48} w={1080} align="center" size={22} weight={700} color="#fff" font="body">
        Welcome! Here's 10% off
      </Text>
    </Group>
    <Group x={0} y={440} name="CodeBox">
      <Box x={340} y={0} w={400} h={64} radius={8} fill="transparent" borderColor="rgba(255,255,255,0.5)" borderWidth={2}>
        <Text x={0} y={0} w={400} h={64} align="center" valign="center" size={22} weight={700} color="#fff" font="display" letterSpacing={3}>
          WELCOME10
        </Text>
      </Box>
    </Group>
    <Text x={0} y={540} w={1080} align="center" size={14} weight={400} color="rgba(255,255,255,0.7)" font="body">
      Show this at checkout
    </Text>
  </>
);

FirstVisitOffer.id = 'first-visit-offer';
FirstVisitOffer.label = 'First Visit Offer';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [FirstVisitOffer] satisfies Scene[];
