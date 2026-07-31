import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Instagram Feed Post ── */
const FeedPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative */}
    <Ellipse x={760} y={-120} w={500} h={500} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Brand header */}
    <Group x={80} y={48} name="Brand">
      <Box x={0} y={3} w={22} h={18} radius={3} fill="var(--ox-accent)" />
      <Box x={3} y={6} w={16} h={12} radius={2} fill="var(--ox-accent2)" />
      <Box x={7} y={23} w={8} h={5} radius={2} fill="var(--ox-accent)" />
      <Text x={32} y={0} w={300} size={18} weight={700} color="var(--ox-fg)" font="display">Luxe Café</Text>
    </Group>

    {/* Image placeholder */}
    <Box x={80} y={120} w={640} h={640} radius={20} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={640} h={640} align="center" valign="center" size={80} color="var(--ox-muted)" font="body" opacity={0.2}>☕</Text>
    </Box>

    {/* Side content */}
    <Group x={760} y={200} name="Content">
      <Line x={0} y={0} w={40} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={24} w={260} size={32} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Morning
      </Text>
      <Text x={0} y={68} w={260} size={28} weight={600} color="var(--ox-accent)" font="display" letterSpacing={-0.5}>
        Ritual
      </Text>

      <Text x={0} y={116} w={240} size={13} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Start your day with our signature espresso blend. Smooth, bold, unforgettable.
      </Text>
    </Group>

    {/* Footer */}
    <Line x={80} y={840} w={920} thickness={1} color="var(--ox-muted)" opacity={0.15} />
    <Text x={80} y={860} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Luxe Café — @luxecafe
    </Text>
  </>
);
FeedPost.id = 'feed-post';
FeedPost.label = 'Feed Post';

/* ── Scene 2: Story Template ── */
const StoryTemplate: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-accent)" />

    {/* Decorative circles */}
    <Ellipse x={-120} y={-120} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={1200} w={500} h={500} fill="var(--ox-bg)" opacity={0.04} />

    {/* Top brand */}
    <Box x={0} y={0} w={1080} h={6} fill="var(--ox-accent2)" />
    <Group x={480} y={40} name="Logo">
      <Box x={0} y={3} w={24} h={20} radius={3} fill="var(--ox-accent2)" opacity={0.9} />
      <Box x={3} y={6} w={18} h={14} radius={2} fill="var(--ox-bg)" />
      <Box x={6} y={26} w={12} h={6} radius={2} fill="var(--ox-accent2)" opacity={0.9} />
    </Group>

    <Group x={80} y={400} name="Story Content">
      <Text x={0} y={0} w={920} size={72} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Fresh
      </Text>
      <Text x={0} y={96} w={920} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Brewed Daily
      </Text>

      <Line x={0} y={180} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={216} w={640} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6}>
        Single-origin beans. Expertly roasted. Crafted with care.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={560} w={260} h={60} radius={30} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={260} h={60} align="center" valign="center" size={14} weight={700} color="var(--ox-fg)" font="body" letterSpacing={1}>
        Order Now
      </Text>
    </Box>

    <Line x={80} y={1840} w={920} thickness={1} color="var(--ox-bg)" opacity={0.15} />
    <Text x={80} y={1860} w={600} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
      @luxecafe
    </Text>
  </>
);
StoryTemplate.id = 'story';
StoryTemplate.label = 'Story';

/* ── Scene 3: Promotion Post ── */
const PromotionPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent2)" />

    <Ellipse x={-80} y={-80} w={400} h={400} fill="var(--ox-fg)" opacity={0.04} />
    <Ellipse x={800} y={700} w={500} h={500} fill="var(--ox-fg)" opacity={0.04} />

    <Group x={80} y={60} name="Brand">
      <Box x={0} y={3} w={22} h={18} radius={3} fill="var(--ox-fg)" opacity={0.8} />
      <Box x={3} y={6} w={16} h={12} radius={2} fill="var(--ox-bg)" />
      <Box x={7} y={23} w={8} h={5} radius={2} fill="var(--ox-fg)" opacity={0.8} />
      <Text x={32} y={0} w={300} size={18} weight={700} color="var(--ox-fg)" font="display">Luxe Café</Text>
    </Group>

    <Group x={80} y={280} name="Offer">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-fg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Happy Hour
      </Text>

      <Text x={0} y={44} w={920} size={80} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-2}>
        Buy One
      </Text>
      <Text x={0} y={140} w={920} size={64} weight={600} color="var(--ox-fg)" font="display" letterSpacing={-1.5}>
        Get One Free
      </Text>

      <Line x={0} y={228} w={80} thickness={3} color="var(--ox-fg)" opacity={0.5} />

      <Text x={0} y={260} w={640} size={16} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5} opacity={0.85}>
        Every weekday 4–6 PM. Any handcrafted beverage.
      </Text>
    </Group>

    <Box x={80} y={420} w={220} h={52} radius={26} fill="var(--ox-fg)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-accent2)" font="body">
        Join Us
      </Text>
    </Box>
  </>
);
PromotionPost.id = 'promotion-post';
PromotionPost.label = 'Promotion Post';

export const meta: DesignMeta = {
  theme: 'luxecafe',
  title: 'Luxe Café — Social Media',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [FeedPost, StoryTemplate, PromotionPost] satisfies Scene[];
