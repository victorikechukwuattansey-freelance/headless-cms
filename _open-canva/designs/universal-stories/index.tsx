import { Box, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Question Story ── */
const QuestionStory: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-accent)" />

    <Group x={80} y={200} name="Header">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Q&A
      </Text>
      <Text x={0} y={40} w={920} size={72} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Ask Us
      </Text>
      <Text x={0} y={136} w={920} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Anything
      </Text>
    </Group>

    {/* Question box */}
    <Box x={80} y={360} w={920} h={120} radius={20} fill="var(--ox-bg)" opacity={0.12} center>
      <Text x={40} y={0} w={840} h={120} align="center" valign="center" size={18} weight={500} color="var(--ox-bg)" font="body">
        What would you like to know?
      </Text>
    </Box>

    <Text x={80} y={540} w={920} size={16} weight={400} color="var(--ox-bg)" font="body" opacity={0.7}>
      Drop your questions in the comments 💬
    </Text>

    {/* Bottom brand */}
    <Line x={80} y={1840} w={920} thickness={1} color="var(--ox-bg)" opacity={0.15} />
    <Text x={80} y={1860} w={600} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
      @yourbrand
    </Text>
  </>
);
QuestionStory.id = 'question-story';
QuestionStory.label = 'Question Story';

/* ── Scene 2: Flash Sale Story ── */
const FlashSale: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-fg)" />

    {/* Top accent bar */}
    <Box x={0} y={0} w={1080} h={6} fill="var(--ox-accent2)" />

    <Group x={80} y={360} name="Sale">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase>
        Flash Sale
      </Text>

      <Text x={0} y={48} w={920} size={96} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-3}>
        50%
      </Text>
      <Text x={0} y={160} w={920} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        OFF
      </Text>

      <Line x={0} y={240} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={272} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.5}>
        Limited time offer. Shop now before it's gone.
      </Text>
    </Group>

    {/* Timer placeholder */}
    <Box x={80} y={520} w={400} h={60} radius={30} fill="var(--ox-surface)" opacity={0.1} center>
      <Text x={0} y={0} w={400} h={60} align="center" valign="center" size={16} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={2}>
        23 : 59 : 48
      </Text>
    </Box>

    {/* CTA */}
    <Box x={80} y={640} w={280} h={60} radius={30} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={280} h={60} align="center" valign="center" size={15} weight={700} color="var(--ox-fg)" font="body" letterSpacing={1}>
        Shop Sale
      </Text>
    </Box>
  </>
);
FlashSale.id = 'flash-sale';
FlashSale.label = 'Flash Sale';

/* ── Scene 3: Product Spotlight Story ── */
const ProductSpotlight: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-bg)" />

    {/* Product image area */}
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={1080} h={1080} align="center" valign="center" size={80} color="var(--ox-muted)" font="body" opacity={0.2}>🖼</Text>
    </Box>

    {/* Brand bar overlay */}
    <Box x={0} y={0} w={1080} h={4} fill="var(--ox-accent)" />

    {/* Product info bottom sheet */}
    <Box x={0} y={1080} w={1080} h={840} fill="var(--ox-bg)" />

    <Group x={80} y={1140} name="Info">
      <Text x={0} y={0} w={920} size={12} weight={600} color="var(--ox-accent)" font="body" letterSpacing={3} uppercase>
        Featured Product
      </Text>

      <Text x={0} y={32} w={920} size={42} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1.5}>
        Premium Product
      </Text>

      <Text x={0} y={96} w={640} size={16} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        The perfect addition to your daily routine. Crafted with premium materials.
      </Text>

      <Text x={0} y={180} w={400} size={32} weight={700} color="var(--ox-accent)" font="display">
        $79.00
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={1380} w={920} h={60} radius={30} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={920} h={60} align="center" valign="center" size={15} weight={600} color="var(--ox-bg)" font="body" letterSpacing={1}>
        Shop Now
      </Text>
    </Box>
  </>
);
ProductSpotlight.id = 'product-spotlight';
ProductSpotlight.label = 'Product Spotlight';

/* ── Scene 4: Reel Cover ── */
const ReelCover: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-fg)" />

    {/* Gradient overlay effect */}
    <Box x={0} y={800} w={1080} h={1120} fill="var(--ox-accent)" opacity={0.12} />

    {/* Play button */}
    <Box x={460} y={440} w={160} h={160} radius={80} fill="var(--ox-accent2)" opacity={0.9} center>
      <Text x={0} y={0} w={160} h={160} align="center" valign="center" size={48} color="var(--ox-fg)" font="body">▶</Text>
    </Box>

    <Group x={80} y={720} name="Reel Info">
      <Text x={0} y={0} w={920} size={56} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Tutorial
      </Text>
      <Text x={0} y={76} w={920} size={36} weight={400} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        How It Works
      </Text>

      <Line x={0} y={140} w={60} thickness={3} color="var(--ox-accent2)" />
    </Group>

    {/* Bottom info */}
    <Line x={80} y={1840} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1860} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Swipe up to watch
    </Text>
  </>
);
ReelCover.id = 'reel-cover';
ReelCover.label = 'Reel Cover';

export const meta: DesignMeta = {
  theme: 'universal',
  title: 'Universal Social Media — Stories & Reels',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1920 };

export default [QuestionStory, FlashSale, ProductSpotlight, ReelCover] satisfies Scene[];
