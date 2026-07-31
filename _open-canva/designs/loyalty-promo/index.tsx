import { Box, Text, Ellipse, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const LoyaltyPromo: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="#fff" />
    <Group x={140} y={280} name="LoyaltyCard">
      <Box x={0} y={0} w={800} h={400} radius={20} fill={C.cream} borderColor={C.gold} borderWidth={3}>
        <Text x={0} y={32} w={800} align="center" size={28} weight={700} color={C.charcoal} font="display">
          Loyalty Card
        </Text>
        <Group x={80} y={120} name="Stamps">
          {[0, 1, 2, 3, 4].map((i) => (
            <Ellipse key={i} x={i * 150} y={0} w={52} h={52} fill={C.gold} />
          ))}
        </Group>
        <Text x={0} y={220} w={800} align="center" size={14} color={C.muted} font="body">
          Collect 5 stamps to earn a free meal
        </Text>
      </Box>
    </Group>
    <Text x={0} y={730} w={1080} align="center" size={18} weight={500} color={C.muted} font="body">
      Earn points with every visit
    </Text>
  </>
);

LoyaltyPromo.id = 'loyalty-promo';
LoyaltyPromo.label = 'Loyalty Promotion';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [LoyaltyPromo] satisfies Scene[];
