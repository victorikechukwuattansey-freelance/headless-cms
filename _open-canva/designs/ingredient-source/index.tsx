import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="Farm fresh ingredients" />
    <PhotoOverlay x={0} y={0} w={1080} h={1080}>
      <Text x={80} y={860} w={920} size={22} weight={700} color={C.white} font="display">
        From Farm to Table
      </Text>
      <Text x={80} y={894} w={920} size={16} weight={400} color={C.white} font="body">
        Sourced from local farms
      </Text>
    </PhotoOverlay>
  </>
);

Main.id = 'ingredient-source';
Main.label = 'Ingredient Source';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Ingredient Source',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
