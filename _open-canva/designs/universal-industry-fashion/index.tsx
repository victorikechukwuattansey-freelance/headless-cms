import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Lookbook Post ── */
const LookbookPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Model image placeholder */}
    <Box x={60} y={60} w={520} h={600} radius={0} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={520} h={600} align="center" valign="center" size={80} color="var(--ox-muted)" font="body" opacity={0.2}>✦</Text>
    </Box>

    {/* Right content */}
    <Group x={620} y={160} name="Details">
      <Box x={0} y={0} w={60} h={2} fill="var(--ox-accent2)" />

      <Text x={0} y={20} w={400} size={12} weight={600} color="var(--ox-accent)" font="body" letterSpacing={4} uppercase>
        Fall Collection
      </Text>

      <Text x={0} y={52} w={400} size={48} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Runway
      </Text>
      <Text x={0} y={112} w={400} size={36} weight={400} color="var(--ox-accent)" font="display" letterSpacing={-0.5}>
        Edit
      </Text>

      <Line x={0} y={160} w={60} thickness={1} color="var(--ox-muted)" opacity={0.3} />

      <Text x={0} y={184} w={380} size={14} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Discover the latest looks from our runway collection. Elegance redefined.
      </Text>
    </Group>

    {/* Brand mark */}
    <Box x={60} y={700} w={48} h={48} fill="var(--ox-accent)" />
    <Box x={68} y={708} w={32} h={32} fill="var(--ox-accent2)" />
    <Text x={120} y={708} w={300} size={18} weight={700} color="var(--ox-fg)" font="display" letterSpacing={3} uppercase>
      ORELIS
    </Text>
  </>
);
LookbookPost.id = 'lookbook-post';
LookbookPost.label = 'Lookbook Post';

/* ── Scene 2: Collection Launch ── */
const CollectionLaunch: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    {/* Decorative */}
    <Box x={760} y={-40} w={400} h={400} fill="var(--ox-accent)" opacity={0.08} />
    <Ellipse x={-80} y={700} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    <Group x={80} y={240} name="Launch">
      <Text x={0} y={0} w={920} size={80} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        New
      </Text>
      <Text x={0} y={104} w={920} size={64} weight={400} color="var(--ox-accent2)" font="display" letterSpacing={3} uppercase>
        Collection
      </Text>

      <Line x={0} y={200} w={80} thickness={2} color="var(--ox-accent2)" />

      <Text x={0} y={236} w={640} size={16} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Dropping this season. Be first in line.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={400} w={200} h={52} radius={0} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={200} h={52} align="center" valign="center" size={12} weight={600} color="var(--ox-fg)" font="body" letterSpacing={2} uppercase>
        Shop Now
      </Text>
    </Box>

    {/* Footer */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1000} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
      @houseoforelis
    </Text>
  </>
);
CollectionLaunch.id = 'collection-launch';
CollectionLaunch.label = 'Collection Launch';

/* ── Scene 3: Fashion Story ── */
const FashionStory: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-bg)" />
    <Box x={0} y={0} w={1080} h={4} fill="var(--ox-accent2)" />

    {/* Product image */}
    <Box x={80} y={80} w={920} h={1000} radius={0} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={920} h={1000} align="center" valign="center" size={100} color="var(--ox-muted)" font="body" opacity={0.2}>◆</Text>
    </Box>

    {/* Overlay label */}
    <Box x={80} y={900} w={320} h={60} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={320} h={60} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body" letterSpacing={3} uppercase>
        New Arrival
      </Text>
    </Box>

    <Group x={80} y={1140} name="Product Info">
      <Text x={0} y={0} w={920} size={20} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
        Fall / Winter 2026
      </Text>
      <Text x={0} y={36} w={920} size={42} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Silk Evening Gown
      </Text>

      <Line x={0} y={100} w={60} thickness={1} color="var(--ox-accent2)" />

      <Text x={0} y={120} w={640} size={15} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Premium silk · Hand-finished · Limited edition
      </Text>

      <Text x={0} y={200} w={400} size={36} weight={700} color="var(--ox-accent)" font="display">
        $1,200
      </Text>
    </Group>
  </>
);
FashionStory.id = 'fashion-story';
FashionStory.label = 'Fashion Story';

/* ── Scene 4: Luxury Product Highlight ── */
const ProductHighlight: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Product image */}
    <Box x={80} y={100} w={480} h={580} fill="var(--ox-bg)" opacity={0.95} center>
      <Text x={0} y={0} w={480} h={580} align="center" valign="center" size={80} color="var(--ox-muted)" font="body" opacity={0.2}>◈</Text>
    </Box>

    <Group x={600} y={180} name="Details">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase>
        Bestseller
      </Text>

      <Text x={0} y={32} w={400} size={42} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-1}>
        Leather
      </Text>
      <Text x={0} y={88} w={400} size={36} weight={400} color="var(--ox-accent2)" font="display" letterSpacing={-0.5}>
        Tote
      </Text>

      <Line x={0} y={136} w={60} thickness={1} color="var(--ox-accent2)" opacity={0.5} />

      <Text x={0} y={160} w={380} size={13} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.85}>
        Italian leather · Handcrafted · Gold hardware
      </Text>
    </Group>
  </>
);
ProductHighlight.id = 'product-highlight';
ProductHighlight.label = 'Product Highlight';

export const meta: DesignMeta = {
  theme: 'universalFashion',
  title: 'Universal — Fashion Industry Pack',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [LookbookPost, CollectionLaunch, FashionStory, ProductHighlight] satisfies Scene[];
