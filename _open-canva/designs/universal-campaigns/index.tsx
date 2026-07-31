import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Product Launch ── */
const ProductLaunch: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    {/* Decorative */}
    <Ellipse x={-80} y={-80} w={400} h={400} fill="var(--ox-accent)" opacity={0.06} />
    <Ellipse x={800} y={600} w={500} h={500} fill="var(--ox-accent2)" opacity={0.05} />

    {/* Top bar */}
    <Box x={0} y={0} w={1080} h={4} fill="var(--ox-accent)" />

    {/* Brand */}
    <Group x={80} y={60} name="Brand">
      <Box x={0} y={0} w={28} h={28} radius={6} fill="var(--ox-accent)" />
      <Box x={5} y={5} w={18} h={18} radius={4} fill="var(--ox-accent2)" />
      <Text x={40} y={2} w={300} size={18} weight={700} color="var(--ox-bg)" font="display">Brand</Text>
    </Group>

    <Group x={80} y={280} name="Launch">
      <Text x={0} y={0} w={600} size={12} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase opacity={0.8}>
        Product Launch
      </Text>

      <Text x={0} y={40} w={920} size={72} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Introducing
      </Text>
      <Text x={0} y={132} w={920} size={56} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1.5}>
        Product Name
      </Text>

      <Line x={0} y={216} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={248} w={640} size={16} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        The next generation of innovation is here. Available now.
      </Text>
    </Group>

    {/* CTA */}
    <Box x={80} y={440} w={220} h={52} radius={26} fill="var(--ox-accent)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-bg)" font="body">
        Pre-Order Now
      </Text>
    </Box>

    {/* Date */}
    <Text x={80} y={520} w={400} size={13} weight={400} color="var(--ox-muted)" font="body">
      Available August 15, 2026
    </Text>
  </>
);
ProductLaunch.id = 'product-launch';
ProductLaunch.label = 'Product Launch';

/* ── Scene 2: Sale Campaign ── */
const SaleCampaign: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent2)" />

    <Ellipse x={-120} y={-120} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={700} w={500} h={500} fill="var(--ox-fg)" opacity={0.04} />

    <Group x={80} y={260} name="Sale">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-fg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Limited Offer
      </Text>

      <Text x={0} y={48} w={920} size={96} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-3}>
        40%
      </Text>
      <Text x={0} y={160} w={920} size={64} weight={600} color="var(--ox-fg)" font="display" letterSpacing={-1.5}>
        OFF
      </Text>

      <Line x={0} y={248} w={80} thickness={3} color="var(--ox-fg)" opacity={0.5} />

      <Text x={0} y={280} w={640} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        On all products. Use code: SAVE40
      </Text>
    </Group>

    <Box x={80} y={440} w={220} h={52} radius={26} fill="var(--ox-fg)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-accent2)" font="body">
        Shop Sale
      </Text>
    </Box>
  </>
);
SaleCampaign.id = 'sale-campaign';
SaleCampaign.label = 'Sale Campaign';

/* ── Scene 3: Black Friday ── */
const BlackFriday: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-fg)" />

    <Group x={80} y={260} name="BF">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={6} uppercase>
        Black Friday
      </Text>

      <Text x={0} y={48} w={920} size={96} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Up to
      </Text>
      <Text x={0} y={160} w={920} size={80} weight={700} color="var(--ox-accent2)" font="display" letterSpacing={-2}>
        70% Off
      </Text>

      <Line x={0} y={260} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={292} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.5}>
        Black Friday week starts now. Don't miss out.
      </Text>
    </Group>

    <Box x={80} y={440} w={220} h={52} radius={26} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={700} color="var(--ox-fg)" font="body">
        Shop Deals
      </Text>
    </Box>

    {/* Timer */}
    <Text x={80} y={520} w={400} size={14} weight={400} color="var(--ox-muted)" font="body" letterSpacing={1}>
      Ends in 3 days
    </Text>
  </>
);
BlackFriday.id = 'black-friday';
BlackFriday.label = 'Black Friday';

/* ── Scene 4: Holiday Promotion ── */
const HolidayPromo: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    {/* Decorative dots */}
    <Ellipse x={120} y={180} w={12} h={12} fill="var(--ox-bg)" opacity={0.15} />
    <Ellipse x={380} y={120} w={8} h={8} fill="var(--ox-bg)" opacity={0.15} />
    <Ellipse x={750} y={200} w={10} h={10} fill="var(--ox-bg)" opacity={0.15} />
    <Ellipse x={200} y={700} w={10} h={10} fill="var(--ox-bg)" opacity={0.12} />
    <Ellipse x={850} y={650} w={14} h={14} fill="var(--ox-bg)" opacity={0.12} />

    <Group x={80} y={280} name="Holiday">
      <Text x={0} y={0} w={920} size={12} weight={600} color="var(--ox-bg)" font="body" letterSpacing={4} uppercase opacity={0.7}>
        Holiday Special
      </Text>

      <Text x={0} y={44} w={920} size={64} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Gift Guide
      </Text>
      <Text x={0} y={128} w={920} size={40} weight={400} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        2026
      </Text>

      <Line x={0} y={196} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={228} w={640} size={16} weight={300} color="var(--ox-bg)" font="body" lineHeight={1.6} opacity={0.9}>
        Find the perfect gift. Curated collections for everyone on your list.
      </Text>
    </Group>

    <Box x={80} y={420} w={220} h={52} radius={26} fill="var(--ox-accent2)" center>
      <Text x={0} y={0} w={220} h={52} align="center" valign="center" size={13} weight={600} color="var(--ox-fg)" font="body">
        Shop Gifts
      </Text>
    </Box>
  </>
);
HolidayPromo.id = 'holiday-promo';
HolidayPromo.label = 'Holiday Promo';

export const meta: DesignMeta = {
  theme: 'universal',
  title: 'Universal — Marketing Campaigns',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [ProductLaunch, SaleCampaign, BlackFriday, HolidayPromo] satisfies Scene[];
