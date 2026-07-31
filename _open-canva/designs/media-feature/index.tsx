import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.charcoal}>
    <Text x={80} y={380} w={920} size={28} italic align="center" color={C.white} font="display">
      {"\"A hidden gem in the city.\""}
    </Text>
    <Divider x={324} y={520} w={432} color={C.gold} />
    <Text x={80} y={560} w={920} size={18} weight={600} align="center" color={C.gold} font="body">
      — Food & Wine Magazine
    </Text>
  </Box>
);

Main.id = 'media-feature';
Main.label = 'Media Feature';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Media Feature',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
