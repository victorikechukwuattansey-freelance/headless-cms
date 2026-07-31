import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, HeaderBar, PhotoArea, Badge, CTAButton, PriceTag, StarRating, Divider, PhotoOverlay, QuoteBlock, HoursRow } from '../../components/restaurant';

const ChefsPick: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1080} label="📷" />
    <Badge x={40} y={40} text="CHEF'S PICK" color="gold" />
    <PhotoOverlay x={0} y={540} w={1080} h={540}>
      <Text x={60} y={60} w={960} size={32} weight={700} color="#ffffff" font="display">
        Truffle Mushroom Risotto
      </Text>
      <Text x={60} y={120} w={960} size={16} weight={400} color="#f0eadd" font="body">
        Arborio rice with wild mushrooms, truffle oil, parmesan crisp, and microgreens.
      </Text>
    </PhotoOverlay>
  </>
);

ChefsPick.id = 'chefs-pick';
ChefsPick.label = "Chef's Pick";

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:23:21.044Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ChefsPick] satisfies Scene[];
