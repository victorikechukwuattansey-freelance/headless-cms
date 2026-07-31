import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Quote Post ── */
const QuotePost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={700} y={-200} w={600} h={600} fill="var(--ox-accent)" opacity={0.04} />

    <Group x={100} y={280} name="Quote">
      <Text x={0} y={0} w={880} size={80} weight={400} color="var(--ox-accent)" font="display" lineHeight={0.8}>
        "
      </Text>
      <Text x={0} y={80} w={880} size={48} weight={600} color="var(--ox-fg)" font="display" letterSpacing={-1} lineHeight={1.2}>
        Design is not just what it looks like.
      </Text>
      <Text x={0} y={200} w={880} size={48} weight={600} color="var(--ox-accent)" font="display" letterSpacing={-1} lineHeight={1.2}>
        It's how it works.
      </Text>
    </Group>

    <Line x={100} y={360} w={60} thickness={3} color="var(--ox-accent2)" />

    <Group x={100} y={760} name="Attribution">
      <Line x={0} y={0} w={40} thickness={1} color="var(--ox-muted)" opacity={0.3} />
      <Text x={0} y={16} w={400} size={14} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>
        — Steve Jobs
      </Text>
    </Group>
  </>
);
QuotePost.id = 'quote-post';
QuotePost.label = 'Quote Post';

/* ── Scene 2: Tip / Educational Post ── */
const TipPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Number */}
    <Text x={80} y={80} w={200} size={96} weight={700} color="var(--ox-bg)" font="display" opacity={0.08}>
      01
    </Text>

    <Group x={80} y={240} name="Tip">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Pro Tip
      </Text>

      <Line x={0} y={24} w={60} thickness={2} color="var(--ox-accent2)" opacity={0.7} />

      <Text x={0} y={56} w={920} size={56} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-1.5}>
        Consistency
      </Text>
      <Text x={0} y={132} w={920} size={48} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        Beats Intensity
      </Text>

      <Text x={0} y={220} w={640} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.9}>
        Small daily efforts compound into remarkable results. Stay consistent, not intense.
      </Text>
    </Group>

    {/* Bottom bar */}
    <Box x={0} y={1070} w={1080} h={10} fill="var(--ox-accent2)" />
  </>
);
TipPost.id = 'tip-post';
TipPost.label = 'Tip Post';

/* ── Scene 3: Product Showcase ── */
const ProductShowcase: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Brand bar */}
    <Box x={0} y={0} w={1080} h={4} fill="var(--ox-accent)" />

    {/* Product image placeholder */}
    <Box x={80} y={80} w={480} h={640} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={480} h={640} align="center" valign="center" size={64} color="var(--ox-muted)" font="body" opacity={0.3}>🖼</Text>
    </Box>

    {/* Product info */}
    <Group x={600} y={160} name="Product Info">
      <Text x={0} y={0} w={400} size={12} weight={600} color="var(--ox-accent)" font="body" letterSpacing={3} uppercase>
        New Arrival
      </Text>

      <Text x={0} y={36} w={400} size={42} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1.5}>
        Product
      </Text>
      <Text x={0} y={96} w={400} size={36} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        Name Here
      </Text>

      <Line x={0} y={140} w={60} thickness={2} color="var(--ox-accent2)" />

      <Text x={0} y={164} w={400} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Short product description highlighting key features and benefits.
      </Text>

      {/* Price */}
      <Text x={0} y={260} w={400} size={36} weight={700} color="var(--ox-accent)" font="display">
        $49.99
      </Text>

      {/* CTA */}
      <Box x={0} y={320} w={200} h={52} radius={26} fill="var(--ox-accent)" center>
        <Text x={0} y={0} w={200} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body" letterSpacing={0.5}>
          Shop Now
        </Text>
      </Box>
    </Group>
  </>
);
ProductShowcase.id = 'product-showcase';
ProductShowcase.label = 'Product Showcase';

/* ── Scene 4: Before & After ── */
const BeforeAfter: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    <Text x={80} y={60} w={600} size={32} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
      Before & After
    </Text>

    {/* Before */}
    <Box x={80} y={140} w={440} h={520} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={440} h={520} align="center" valign="center" size={48} color="var(--ox-muted)" font="body" opacity={0.2}>◌</Text>
      <Text x={0} y={240} w={440} align="center" size={14} weight={600} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Before</Text>
    </Box>

    {/* After */}
    <Box x={560} y={140} w={440} h={520} radius={16} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={440} h={520} align="center" valign="center" size={48} color="var(--ox-bg)" font="body" opacity={0.2}>✦</Text>
      <Text x={0} y={240} w={440} align="center" size={14} weight={600} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>After</Text>
    </Box>

    {/* Arrow indicator */}
    <Text x={480} y={360} w={120} align="center" size={36} color="var(--ox-accent2)" font="body">
      →
    </Text>

    {/* Result stat */}
    <Box x={360} y={720} w={360} h={80} radius={40} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={360} h={80} align="center" valign="center" size={18} weight={600} color="var(--ox-accent)" font="display">
        +85% Improvement
      </Text>
    </Box>
  </>
);
BeforeAfter.id = 'before-after';
BeforeAfter.label = 'Before & After';

/* ── Scene 5: Announcement ── */
const Announcement: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={400} fill="var(--ox-fg)" />
    <Box x={0} y={400} w={1080} h={680} fill="var(--ox-bg)" />

    {/* Top bar */}
    <Box x={0} y={0} w={1080} h={4} fill="var(--ox-accent2)" />

    <Group x={80} y={120} name="Announcement">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase opacity={0.8}>
        Announcing
      </Text>

      <Text x={0} y={36} w={920} size={64} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Big News
      </Text>
      <Text x={0} y={120} w={920} size={52} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Is Here
      </Text>

      <Text x={0} y={200} w={640} size={16} weight={300} color="var(--ox-bg)" font="body" opacity={0.8}>
        We're thrilled to share something we've been working on.
      </Text>
    </Group>

    {/* Bottom content */}
    <Group x={80} y={480} name="Details">
      <Line x={0} y={0} w={60} thickness={3} color="var(--ox-accent2)" />
      <Text x={0} y={24} w={800} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.7}>
        Full announcement details and launch information goes here. This template works for product launches, feature releases, company news, and major updates.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={640} w={200} h={52} radius={26} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={200} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body" letterSpacing={0.5}>
        Learn More
      </Text>
    </Box>
  </>
);
Announcement.id = 'announcement';
Announcement.label = 'Announcement';

/* ── Scene 6: Testimonial ── */
const Testimonial: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    {/* Decorative */}
    <Ellipse x={800} y={-100} w={500} h={500} fill="var(--ox-accent)" opacity={0.05} />

    <Group x={100} y={260} name="Testimonial">
      <Text x={0} y={0} w={880} size={80} weight={400} color="var(--ox-accent)" font="display" lineHeight={0.8}>
        "
      </Text>

      <Text x={0} y={80} w={880} size={36} weight={400} color="var(--ox-bg)" font="display" letterSpacing={-0.5} lineHeight={1.4}>
        This completely transformed how we approach our marketing. The results speak for themselves.
      </Text>
    </Group>

    <Group x={100} y={520} name="Author">
      {/* Avatar */}
      <Box x={0} y={0} w={56} h={56} radius={28} fill="var(--ox-accent2)" center>
        <Text x={0} y={0} w={56} h={56} align="center" valign="center" size={20} weight={600} color="var(--ox-fg)" font="display">JM</Text>
      </Box>
      <Text x={72} y={8} w={400} size={16} weight={600} color="var(--ox-bg)" font="display">Jessica Morgan</Text>
      <Text x={72} y={32} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">CEO, Brightside Co.</Text>
    </Group>

    {/* Rating */}
    <Group x={100} y={640} name="Rating">
      <Text x={0} y={0} w={400} size={20} color="var(--ox-accent2)" font="body">★★★★★</Text>
    </Group>

    {/* Footer */}
    <Line x={100} y={980} w={880} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={100} y={1000} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Social Proof
    </Text>
  </>
);
Testimonial.id = 'testimonial';
Testimonial.label = 'Testimonial';

export const meta: DesignMeta = {
  theme: 'universal',
  title: 'Universal Social Media — Instagram Templates',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [QuotePost, TipPost, ProductShowcase, BeforeAfter, Announcement, Testimonial] satisfies Scene[];
