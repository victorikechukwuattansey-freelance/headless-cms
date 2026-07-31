import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="Kitchen prep" />
    <PhotoOverlay x={0} y={0} w={1080} h={1080}>
      <Text x={80} y={860} w={920} size={22} weight={700} color={C.white} font="display">
        Made Fresh Daily
      </Text>
      <Text x={80} y={894} w={920} size={16} weight={400} color={C.white} font="body">
        Every dish prepared in-house
      </Text>
    </PhotoOverlay>
  </>
);

Main.id = 'kitchen-prep';
Main.label = 'Kitchen Prep';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Kitchen Prep',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
