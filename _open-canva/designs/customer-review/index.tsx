import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.white}>
    <Text x={100} y={340} w={880} size={20} italic align="center" color={C.charcoal} font="display">
      {"\"The best pasta I've had outside of Italy.\""}
    </Text>
    <StarRating x={480} y={480} count={5} size={20} />
    <Text x={100} y={540} w={880} size={14} weight={400} align="center" color={C.muted} font="body">
      — Sarah M.
    </Text>
  </Box>
);

Main.id = 'customer-review';
Main.label = 'Customer Review';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Customer Review',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
