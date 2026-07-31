import { Box, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C } from '../../components/restaurant';

const Contact: Scene = () => (
  <Box x={0} y={0} w={1080} h={1080} fill={C.charcoal}>
    <Text x={0} y={180} w={1080} align="center" size={28} weight={700} color={C.white} font="display">
      Get in Touch
    </Text>
    <Text x={120} y={320} w={400} align="center" size={14} weight={600} color={C.white} font="body">
      📞 0161 123 4567
    </Text>
    <Text x={560} y={320} w={400} align="center" size={14} weight={600} color={C.white} font="body">
      ✉️ hello@resto.com
    </Text>
    <Text x={0} y={800} w={1080} align="center" size={14} weight={500} color={C.muted} font="body">
      📷 @restaurant
    </Text>
  </Box>
);

Contact.id = 'contact';
Contact.label = 'Contact';

export const meta: DesignMeta = {
  theme: 'restaurant',
  title: 'Contact',
  author: 'OpenCanva',
  createdAt: '2026-07-26T13:25:02.101Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Contact] satisfies Scene[];
