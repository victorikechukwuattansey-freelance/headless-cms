import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Product Launch Post ── */
const ProductLaunch: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Decorative organic shapes */}
    <Ellipse x={-120} y={-120} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={600} w={500} h={500} fill="var(--ox-bg)" opacity={0.04} />

    <Group x={80} y={80} name="Logo">
      <Ellipse x={0} y={3} w={24} h={24} fill="var(--ox-bg)" opacity={0.3} />
      <Ellipse x={3} y={6} w={18} h={18} fill="var(--ox-bg)" />
      <Ellipse x={7} y={9} w={10} h={13} fill="var(--ox-accent2)" />
      <Text x={32} y={0} w={300} size={18} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-0.3}>
        Green Harvest
      </Text>
    </Group>

    <Group x={80} y={320} name="Hero">
      <Text x={0} y={0} w={920} size={72} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Fresh From
      </Text>
      <Text x={0} y={96} w={920} size={64} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Nature's Garden
      </Text>

      <Line x={0} y={180} w={80} thickness={3} color="var(--ox-accent2)" opacity={0.7} />

      <Text x={0} y={212} w={640} size={18} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6}>
        Introducing our new organic quinoa blend. Sustainably grown, naturally delicious.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={520} w={220} h={52} radius={26} fill="var(--ox-accent2)" opacity={0.9}>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
        Shop Now
      </Text>
    </Box>

    {/* Bottom herb pattern */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.15} />
    <Text x={80} y={998} w={600} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
      Green Harvest Organics
    </Text>
  </>
);
ProductLaunch.id = 'product-launch';
ProductLaunch.label = 'Product Launch';

/* ── Scene 2: Recipe / Lifestyle Post ── */
const RecipePost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative background */}
    <Ellipse x={-80} y={-80} w={300} h={300} fill="#8DB580" opacity={0.08} />
    <Ellipse x={860} y={700} w={400} h={400} fill="var(--ox-accent2)" opacity={0.05} />

    {/* Content card */}
    <Box x={80} y={100} w={640} h={480} radius={16} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1} />
    <Box x={80} y={100} w={640} h={240} radius={0} fill="var(--ox-accent)" opacity={0.06} />

    {/* Recipe icon */}
    <Ellipse x={160} y={160} w={80} h={80} fill="var(--ox-accent)" opacity={0.1} />
    <Text x={176} y={172} w={48} h={48} align="center" size={32} color="var(--ox-accent)" font="body">🌿</Text>

    <Text x={160} y={260} w={520} size={28} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
      Morning Quinoa Bowl
    </Text>
    <Text x={160} y={304} w={520} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.6}>
      Start your day with this protein-packed bowl made with our organic quinoa blend, fresh berries, and a drizzle of honey.
    </Text>

    {/* Ingredients */}
    <Group x={160} y={420} name="Ingredients">
      <Text x={0} y={0} size={11} weight={600} color="var(--ox-accent)" font="body" letterSpacing={2} uppercase>
        Ingredients
      </Text>
      <Text x={0} y={24} w={520} size={13} weight={400} color="var(--ox-fg)" font="body">
        1 cup Green Harvest Quinoa · 2 cups almond milk · Berries · Honey · Cinnamon
      </Text>
    </Group>

    {/* Right side panel */}
    <Box x={760} y={100} w={240} h={480} radius={16} fill="var(--ox-accent)" />
    <Text x={780} y={260} w={200} size={36} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-1}>
      15
    </Text>
    <Text x={780} y={310} w={200} size={14} weight={400} color="var(--ox-bg)" font="body" lineHeight={1.4}>
      minutes to make
    </Text>
    <Ellipse x={800} y={420} w={160} h={160} fill="var(--ox-bg)" opacity={0.06} />

    {/* Bottom logo */}
    <Group x={80} y={640} name="Footer Logo">
      <Ellipse x={0} y={3} w={20} h={20} fill="var(--ox-accent)" opacity={0.3} />
      <Ellipse x={3} y={6} w={14} h={14} fill="var(--ox-accent)" />
      <Ellipse x={6} y={8} w={8} h={10} fill="var(--ox-accent2)" />
      <Text x={28} y={0} w={200} size={14} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-0.3}>
        Green Harvest
      </Text>
    </Group>

    {/* Hashtags */}
    <Text x={80} y={700} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">
      #OrganicLiving #QuinoaRecipe #PlantBased #GreenHarvest
    </Text>
  </>
);
RecipePost.id = 'recipe-post';
RecipePost.label = 'Recipe Post';

/* ── Scene 3: Sustainability Story ── */
const SustainabilityPost: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    {/* Decorative */}
    <Ellipse x={800} y={-100} w={500} h={500} fill="var(--ox-accent)" opacity={0.06} />
    <Ellipse x={-100} y={600} w={400} h={400} fill="var(--ox-accent2)" opacity={0.04} />

    <Group x={80} y={80} name="Logo">
      <Ellipse x={0} y={3} w={24} h={24} fill="var(--ox-accent2)" opacity={0.5} />
      <Ellipse x={3} y={6} w={18} h={18} fill="var(--ox-accent2)" />
      <Ellipse x={7} y={9} w={10} h={13} fill="var(--ox-bg)" />
      <Text x={32} y={0} w={300} size={18} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-0.3}>
        Green Harvest
      </Text>
    </Group>

    <Group x={80} y={280} name="Story">
      <Text x={0} y={0} w={600} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>
        Our Promise
      </Text>

      <Text x={0} y={36} w={920} size={56} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-1.5}>
        Grown with Care,
      </Text>
      <Text x={0} y={112} w={920} size={48} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        Harvested with Purpose
      </Text>

      <Line x={0} y={176} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={212} w={640} size={16} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        We partner with small-scale farmers in Ghana to bring you the finest organic grains. Every purchase supports sustainable agriculture and fair wages.
      </Text>
    </Group>

    {/* Stats */}
    <Group x={80} y={460} name="Stats">
      <Box x={0} y={0} w={200} h={100} radius={12} fill="var(--ox-surface)" opacity={0.08}>
        <Text x={0} y={20} w={200} align="center" size={32} weight={700} color="var(--ox-accent2)" font="display">200+</Text>
        <Text x={0} y={62} w={200} align="center" size={12} weight={400} color="var(--ox-muted)" font="body">Partner Farmers</Text>
      </Box>
      <Box x={220} y={0} w={200} h={100} radius={12} fill="var(--ox-surface)" opacity={0.08}>
        <Text x={0} y={20} w={200} align="center" size={32} weight={700} color="var(--ox-accent2)" font="display">100%</Text>
        <Text x={0} y={62} w={200} align="center" size={12} weight={400} color="var(--ox-muted)" font="body">Certified Organic</Text>
      </Box>
      <Box x={440} y={0} w={200} h={100} radius={12} fill="var(--ox-surface)" opacity={0.08}>
        <Text x={0} y={20} w={200} align="center" size={32} weight={700} color="var(--ox-accent2)" font="display">0</Text>
        <Text x={0} y={62} w={200} align="center" size={12} weight={400} color="var(--ox-muted)" font="body">Carbon Footprint</Text>
      </Box>
    </Group>

    {/* Footer */}
    <Line x={80} y={980} w={920} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={998} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Green Harvest Organics
    </Text>
  </>
);
SustainabilityPost.id = 'sustainability';
SustainabilityPost.label = 'Sustainability';

/* ── Scene 4: Instagram Story ── */
const StoryScene: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1920} fill="var(--ox-accent)" />

    {/* Decorative */}
    <Ellipse x={-200} y={-200} w={500} h={500} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={700} y={1200} w={600} h={600} fill="var(--ox-bg)" opacity={0.04} />

    <Group x={440} y={80} name="Logo">
      <Ellipse x={0} y={4} w={32} h={32} fill="var(--ox-bg)" opacity={0.3} />
      <Ellipse x={4} y={8} w={24} h={24} fill="var(--ox-bg)" />
      <Ellipse x={10} y={12} w={12} h={16} fill="var(--ox-accent2)" />
    </Group>

    <Group x={80} y={500} name="Story Hero">
      <Text x={0} y={0} w={920} size={80} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Taste the
      </Text>
      <Text x={0} y={108} w={920} size={72} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-2}>
        Difference
      </Text>

      <Line x={0} y={200} w={100} thickness={3} color="var(--ox-accent2)" opacity={0.7} />

      <Text x={0} y={240} w={640} size={20} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6}>
        100% organic. Always fresh. Delivered to your door.
      </Text>
    </Group>

    <Box x={80} y={680} w={280} h={56} radius={28} fill="var(--ox-accent2)" opacity={0.9}>
      <Text x={0} y={0} w={280} h={56} align="center" valign="center" size={14} weight={600} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
        Order Now
      </Text>
    </Box>

    <Text x={80} y={1840} w={600} size={11} weight={400} color="var(--ox-bg)" font="body" letterSpacing={2} uppercase>
      @greenharvestorganics
    </Text>
  </>
);
StoryScene.id = 'story';
StoryScene.label = 'Story';

export const meta: DesignMeta = {
  theme: 'greenharvest',
  title: 'Green Harvest Organics — Social Media',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ProductLaunch, RecipePost, SustainabilityPost, StoryScene] satisfies Scene[];
