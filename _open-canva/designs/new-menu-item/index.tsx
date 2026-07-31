import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const NewMenuItem: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="#ffffff" />
    <Group x={162} y={80} name="Polaroid">
      <Box x={0} y={0} w={756} h={900} fill="#ffffff" borderWidth={2} borderColor="#e0d8cc" shadow="0 8px 32px rgba(0,0,0,0.12)" rotate={-2}>
        <PhotoArea x={28} y={28} w={700} h={700} label="📷" />
        <Text x={0} y={744} w={756} size={18} weight={600} color={C.charcoal} font="body" align="center" rotate={-1}>
          New on the Menu
        </Text>
      </Box>
    </Group>
  </>
);

NewMenuItem.id = 'new-menu-item';
NewMenuItem.label = 'New Menu Item';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [NewMenuItem] satisfies Scene[];
