import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock } from '../../components/restaurant';

const Main: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={540} h={1080} label="Maria Santos" />
    <Box x={540} y={0} w={540} h={1080} fill={C.white}>
      <Text x={30} y={420} w={480} size={22} weight={700} color={C.charcoal} font="display">
        Maria Santos
      </Text>
      <Text x={30} y={454} w={480} size={16} weight={600} color={C.terracotta} font="body">
        Lead Server
      </Text>
      <Text x={30} y={484} w={480} size={14} weight={400} color={C.muted} font="body">
        ⭐ 5 years · Customer favourite
      </Text>
    </Box>
  </>
);

Main.id = 'staff-spotlight';
Main.label = 'Staff Spotlight';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Staff Spotlight',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:21:01.359Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Main] satisfies Scene[];
