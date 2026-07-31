import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Opening Announcement ── */
const OpeningPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />
    <Ellipse x={-120} y={-120} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={600} w={500} h={500} fill="var(--ox-accent2)" opacity={0.06} />

    <Group x={80} y={80} name="Logo">
      <Box x={0} y={0} w={40} h={40} radius={4} fill="var(--ox-bg)" opacity={0.15} />
      <Text x={0} y={0} w={40} h={40} align="center" valign="center" size={20} weight={300} color="var(--ox-bg)" font="display">L</Text>
      <Text x={52} y={6} w={300} size={16} weight={300} color="var(--ox-bg)" font="display" letterSpacing={3} uppercase>Luxe Café</Text>
    </Group>

    <Group x={80} y={320} name="Hero">
      <Text x={0} y={0} w={920} size={80} weight={300} color="var(--ox-bg)" font="display" letterSpacing={2}>
        Now Open
      </Text>
      <Line x={0} y={120} w={80} thickness={2} color="var(--ox-accent2)" opacity={0.7} />
      <Text x={0} y={160} w={640} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.85}>
        Experience premium coffee and artisanal fare in an space designed for the discerning palate.
      </Text>
    </Group>

    <Box x={80} y={480} w={180} h={48} radius={24} fill="var(--ox-accent2)" opacity={0.9}>
      <Text x={0} y={0} w={180} h={48} align="center" valign="center" size={12} weight={600} color="var(--ox-fg)" font="body" letterSpacing={2} uppercase>Visit Us</Text>
    </Box>

    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1000} w={600} size={10} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>@luxecafe — Coming soon</Text>
  </>
);
OpeningPost.id = 'opening-post';
OpeningPost.label = 'Opening Post';

/* ── Scene 2: Product Launch ── */
const ProductLaunch: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={900} y={-100} w={400} h={400} fill="var(--ox-accent)" opacity={0.04} />
    <Ellipse x={-80} y={800} w={300} h={300} fill="var(--ox-accent2)" opacity={0.06} />

    <Group x={80} y={80} name="Logo">
      <Box x={0} y={0} w={32} h={32} radius={4} fill="var(--ox-accent)" />
      <Text x={0} y={0} w={32} h={32} align="center" valign="center" size={16} weight={300} color="var(--ox-bg)" font="display">L</Text>
    </Group>

    <Group x={80} y={260} name="Content">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>New Arrival</Text>
      <Text x={0} y={36} w={640} size={56} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
        Honey Lavender
      </Text>
      <Text x={0} y={108} w={640} size={44} weight={300} color="var(--ox-accent)" font="display" letterSpacing={2}>
        Latte
      </Text>
      <Line x={0} y={176} w={60} thickness={2} color="var(--ox-accent2)" />
      <Text x={0} y={212} w={560} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        House-made lavender syrup meets single-origin espresso and steamed oat milk. A signature creation.
      </Text>
    </Group>

    <Box x={80} y={340} w={200} h={48} radius={24} fill="var(--ox-accent)">
      <Text x={0} y={0} w={200} h={48} align="center" valign="center" size={12} weight={500} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>Order Now</Text>
    </Box>

    {/* Decorative circle */}
    <Ellipse x={760} y={680} w={320} h={320} fill="var(--ox-accent)" opacity={0.03} />
    <Ellipse x={800} y={720} w={240} h={240} fill="var(--ox-accent2)" opacity={0.04} />
  </>
);
ProductLaunch.id = 'product-launch';
ProductLaunch.label = 'Product Launch';

/* ── Scene 3: Instagram Story ── */
const StoryScene: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-bg)" />
    <Ellipse x={500} y={-200} w={600} h={600} fill="var(--ox-accent)" opacity={0.04} />
    <Ellipse x={-100} y={1200} w={500} h={500} fill="var(--ox-accent2)" opacity={0.05} />

    <Group x={80} y={80} name="Logo">
      <Box x={0} y={0} w={36} h={36} radius={4} fill="var(--ox-accent)" opacity={0.8} />
      <Text x={0} y={0} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
    </Group>

    <Group x={80} y={500} name="Hero">
      <Text x={0} y={0} w={920} size={96} weight={300} color="var(--ox-fg)" font="display" letterSpacing={2}>
        Your Daily
      </Text>
      <Text x={0} y={120} w={920} size={80} weight={300} color="var(--ox-accent2)" font="display" letterSpacing={3}>
        Ritual
      </Text>
      <Line x={0} y={220} w={80} thickness={2} color="var(--ox-accent2)" />
      <Text x={0} y={260} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Premium coffee, crafted daily. Find your moment at Luxe Café.
      </Text>
    </Group>

    <Box x={80} y={420} w={220} h={52} radius={26} fill="var(--ox-accent)">
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={500} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>Discover</Text>
    </Box>

    <Text x={80} y={1820} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>@luxecafe</Text>
  </>
);
StoryScene.id = 'story';
StoryScene.label = 'Story';

/* ── Scene 4: Quote Card ── */
const QuoteCard: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={860} y={860} w={400} h={400} fill="var(--ox-accent2)" opacity={0.06} />

    <Box x={80} y={240} w={920} h={560} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} shadow="0 8px 40px rgba(0,0,0,0.04)">
      <Ellipse x={40} y={40} w={60} h={60} fill="var(--ox-accent2)" opacity={0.1} />
      <Text x={52} y={48} w={40} size={36} weight={400} color="var(--ox-accent2)" font="display">&ldquo;</Text>

      <Text x={80} y={140} w={760} size={36} weight={400} color="var(--ox-fg)" font="display" lineHeight={1.4} letterSpacing={0.5}>
        Coffee is a language
      </Text>
      <Text x={80} y={240} w={760} size={36} weight={300} color="var(--ox-accent)" font="display" lineHeight={1.4} letterSpacing={1}>
        in which anyone can
      </Text>
      <Text x={80} y={340} w={760} size={36} weight={300} color="var(--ox-fg)" font="display" lineHeight={1.4} letterSpacing={1}>
        converse with elegance.
      </Text>

      <Line x={80} y={440} w={60} thickness={2} color="var(--ox-accent2)" />
      <Text x={80} y={480} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">— Luxe Café</Text>
    </Box>

    <Line x={80} y={1000} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1020} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>@luxecafe</Text>
  </>
);
QuoteCard.id = 'quote-card';
QuoteCard.label = 'Quote Card';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Social Media',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [OpeningPost, ProductLaunch, StoryScene, QuoteCard] satisfies Scene[];
