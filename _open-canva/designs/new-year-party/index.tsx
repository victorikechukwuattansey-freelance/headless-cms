import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, PhotoArea, Badge } from '../../components/restaurant';

const NewYear: Scene = () => (
  <>
    <PhotoArea x={0} y={0} w={1080} h={1920} label="New Year celebration" />

    <Box x={0} y={0} w={1080} h={1920} fill="linear-gradient(180deg, rgba(0,0,0,0.7), transparent 40%, transparent 60%, rgba(0,0,0,0.7))">
      <Text x={0} y={780} w={1080} align="center" size={64} weight={700} color={C.gold} font="display">
        2026
      </Text>
      <Badge x={440} y={880} text="Book Your Table" color="gold" />
    </Box>
  </>
);

NewYear.id = 'new-year-party';
NewYear.label = 'New Year Party';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'New Year Party',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:20:55.841Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [NewYear] satisfies Scene[];
