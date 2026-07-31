import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const PlatterCloseup: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="📷 Platter" />
    <PhotoOverlay x={0} y={640} w={1080} h={440}>
      <Text x={60} y={40} w={960} size={36} weight={700} color="#ffffff" font="display">
        Sunday Roast Platter
      </Text>
      <Text x={60} y={100} w={960} size={18} weight={500} color="#f0eadd" font="body">
        Feeds 2 · $38
      </Text>
    </PhotoOverlay>
  </>
);

PlatterCloseup.id = 'platter-closeup';
PlatterCloseup.label = 'Platter Closeup';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [PlatterCloseup] satisfies Scene[];
