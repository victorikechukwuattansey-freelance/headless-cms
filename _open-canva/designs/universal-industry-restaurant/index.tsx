import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Restaurant Post ── */
const RestaurantPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative */}
    <Ellipse x={800} y={-120} w={500} h={500} fill="var(--ox-accent)" opacity={0.04} />
    <Ellipse x={-80} y={800} w={400} h={400} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Food image placeholder */}
    <Box x={80} y={80} w={580} h={580} radius={20} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} center>
      <Text x={0} y={0} w={580} h={580} align="center" valign="center" size={80} color="var(--ox-muted)" font="body" opacity={0.25}>🍽</Text>
    </Box>

    {/* Info */}
    <Group x={700} y={160} name="Info">
      <Box x={0} y={0} w={80} h={4} fill="var(--ox-accent2)" />
      <Text x={0} y={20} w={320} size={36} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1}>
        Signature
      </Text>
      <Text x={0} y={72} w={320} size={32} weight={600} color="var(--ox-accent)" font="display" letterSpacing={-0.5}>
        Dish Name
      </Text>

      <Text x={0} y={128} w={300} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.5}>
        Fresh ingredients, bold flavors. Made with love.
      </Text>
    </Group>

    {/* Footer */}
    <Line x={80} y={740} w={920} thickness={1} color="var(--ox-muted)" opacity={0.15} />
    <Group x={80} y={760} name="Restaurant Name">
      <Box x={0} y={0} w={24} h={24} radius={6} fill="var(--ox-accent)" />
      <Box x={5} y={5} w={14} h={14} radius={3} fill="var(--ox-accent2)" />
      <Text x={36} y={0} w={300} size={16} weight={700} color="var(--ox-fg)" font="display">Restaurant Name</Text>
    </Group>
  </>
);
RestaurantPost.id = 'restaurant-post';
RestaurantPost.label = 'Restaurant Post';

/* ── Scene 2: Menu Highlight ── */
const MenuHighlight: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    <Ellipse x={-100} y={-100} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={700} w={500} h={500} fill="var(--ox-bg)" opacity={0.04} />

    <Group x={100} y={200} name="Menu">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        From the Menu
      </Text>

      <Text x={0} y={44} w={880} size={64} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Grilled
      </Text>
      <Text x={0} y={128} w={880} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Salmon Bowl
      </Text>

      <Line x={0} y={212} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={244} w={640} size={16} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.9}>
        Atlantic salmon · quinoa · avocado · citrus vinaigrette · micro greens
      </Text>

      <Text x={0} y={340} w={400} size={36} weight={700} color="var(--ox-accent2)" font="display">
        $24.00
      </Text>
    </Group>

    {/* Badge */}
    <Box x={100} y={460} w={140} h={36} radius={18} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={140} h={36} align="center" valign="center" size={11} weight={700} color="var(--ox-fg)" font="body" letterSpacing={1}>
        Chef's Pick
      </Text>
    </Box>
  </>
);
MenuHighlight.id = 'menu-highlight';
MenuHighlight.label = 'Menu Highlight';

/* ── Scene 3: Restaurant Story ── */
const RestaurantStory: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-fg)" />

    <Ellipse x={700} y={-200} w={600} h={600} fill="var(--ox-accent)" opacity={0.06} />
    <Ellipse x={-200} y={1000} w={500} h={500} fill="var(--ox-accent2)" opacity={0.04} />

    <Group x={80} y={400} name="Story Content">
      <Text x={0} y={0} w={920} size={72} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        New Menu
      </Text>
      <Text x={0} y={96} w={920} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Coming Soon
      </Text>

      <Line x={0} y={180} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={216} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Exciting new dishes arriving this season. Stay tuned for a taste experience.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={640} w={280} h={56} radius={28} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={280} h={56} align="center" valign="center" size={14} weight={600} color="var(--ox-bg)" font="body" letterSpacing={0.5}>
        Reserve a Table
      </Text>
    </Box>

    <Line x={80} y={1840} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1860} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      @restaurantname
    </Text>
  </>
);
RestaurantStory.id = 'restaurant-story';
RestaurantStory.label = 'Restaurant Story';

/* ── Scene 4: Special Offer ── */
const SpecialOffer: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent2)" />

    <Group x={100} y={260} name="Offer">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-fg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Limited Time
      </Text>

      <Text x={0} y={44} w={880} size={72} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-2}>
        Happy Hour
      </Text>

      <Line x={0} y={140} w={80} thickness={3} color="var(--ox-accent)" />

      <Text x={0} y={172} w={640} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        Mon–Fri · 4–7 PM · 50% off select drinks & appetizers
      </Text>
    </Group>

    <Box x={100} y={420} w={220} h={52} radius={26} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body">
        Join Us
      </Text>
    </Box>
  </>
);
SpecialOffer.id = 'special-offer';
SpecialOffer.label = 'Special Offer';

export const meta: DesignMeta = {
  theme: 'universalRestaurant',
  title: 'Universal — Restaurant Industry Pack',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [RestaurantPost, MenuHighlight, RestaurantStory, SpecialOffer] satisfies Scene[];
