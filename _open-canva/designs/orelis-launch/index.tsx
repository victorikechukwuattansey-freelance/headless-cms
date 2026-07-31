import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Announcement ── */
const Announcement: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    <Group x={80} y={80} name="Logo">
      <Box x={0} y={0} w={32} h={32} fill="var(--ox-accent2)" />
    </Group>

    <Group x={80} y={360} name="Hero">
      <Line x={0} y={0} w={80} thickness={3} color="var(--ox-accent2)" />
      <Text x={0} y={28} w={920} size={80} weight={700} color="var(--ox-bg)" font="display" letterSpacing={6} uppercase>
        Coming
      </Text>
      <Text x={0} y={136} w={920} size={64} weight={400} color="var(--ox-accent2)" font="display" letterSpacing={10} uppercase>
        Soon
      </Text>
    </Group>

    <Text x={80} y={560} w={640} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} letterSpacing={1}>
      The new collection arrives this season. Be the first to experience luxury redefined.
    </Text>

    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.2} />
    <Text x={80} y={998} w={600} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
      House of Orelis
    </Text>
  </>
);
Announcement.id = 'announcement';
Announcement.label = 'Announcement';

/* ── Scene 2: Collection Grid ── */
const CollectionGrid: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    <Group x={80} y={48} name="Header">
      <Box x={0} y={0} w={20} h={20} fill="var(--ox-accent2)" />
      <Text x={32} y={0} w={400} size={14} weight={600} color="var(--ox-accent)" font="display" letterSpacing={4} uppercase>
        ORELIS
      </Text>
    </Group>

    <Line x={80} y={100} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />

    <Text x={80} y={130} w={600} size={36} weight={600} color="var(--ox-fg)" font="display" letterSpacing={2}>
      The Collection
    </Text>

    {/* Product grid placeholders */}
    <Box x={80} y={220} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>
    <Box x={400} y={220} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>
    <Box x={720} y={220} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>

    <Box x={80} y={620} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>
    <Box x={400} y={620} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>
    <Box x={720} y={620} w={280} h={360} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
      <Text x={0} y={160} w={280} align="center" size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Product
      </Text>
    </Box>
  </>
);
CollectionGrid.id = 'collection-grid';
CollectionGrid.label = 'Collection Grid';

/* ── Scene 3: Follow CTA ── */
const FollowCTA: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    <Group x={80} y={360} name="CTA">
      <Box x={0} y={0} w={48} h={48} fill="var(--ox-accent2)" opacity={0.3} />
      <Box x={12} y={12} w={24} h={24} fill="var(--ox-accent2)" />

      <Text x={0} y={80} w={920} size={56} weight={700} color="var(--ox-bg)" font="display" letterSpacing={6} uppercase>
        Follow Us
      </Text>

      <Line x={0} y={160} w={120} thickness={2} color="var(--ox-accent2)" />

      <Text x={0} y={196} w={640} size={16} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6} letterSpacing={1}>
        @houseoforelis
      </Text>
    </Group>

    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.15} />
    <Text x={80} y={998} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      House of Orelis
    </Text>
  </>
);
FollowCTA.id = 'follow-cta';
FollowCTA.label = 'Follow CTA';

export const meta: DesignMeta = {
  theme: 'orelis',
  title: 'House of Orelis — Launch Kit',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [Announcement, CollectionGrid, FollowCTA] satisfies Scene[];
