import { Box, Text, Group } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';
import { C, Badge } from '../../components/restaurant';

const StudentDiscount: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Group x={0} y={340} name="Content">
      <Text x={0} y={0} w={1080} align="center" size={64}>
        🎓
      </Text>
      <Text x={0} y={90} w={1080} align="center" size={26} weight={700} color={C.charcoal} font="display">
        Student Discount
      </Text>
    </Group>
    <Group x={0} y={480} name="Badge">
      <Box x={430} y={0} w={220} h={48} radius={24} fill={C.terracotta}>
        <Text x={0} y={0} w={220} h={48} align="center" valign="center" size={16} weight={700} color="#fff" font="body" letterSpacing={1}>
          15% OFF
        </Text>
      </Box>
    </Group>
    <Text x={0} y={560} w={1080} align="center" size={14} weight={400} color={C.muted} font="body">
      With valid ID
    </Text>
  </>
);

StudentDiscount.id = 'student-discount';
StudentDiscount.label = 'Student Discount';

export const meta: DesignMeta = {
  theme: 'restaurant',
  createdAt: '2026-07-26T13:20:51.272Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [StudentDiscount] satisfies Scene[];
