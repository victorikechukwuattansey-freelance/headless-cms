import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <Box x={0} y={0} w={1080} h={1920} fill={C.cream}>
    <Text x={140} y={500} w={800} size={80} weight={700} align="center" color={C.charcoal} font="display">
      4.8
    </Text>
    <StarRating x={472} y={620} count={5} size={24} />
    <Text x={140} y={680} w={800} size={20} weight={400} align="center" color={C.muted} font="body">
      Google Reviews
    </Text>
    <Badge x={472} y={760} text="Leave a Review" />
  </Box>
);

Main.id = 'rating-promo';
Main.label = 'Rating Promo';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Rating Promo',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [Main] satisfies Scene[];
