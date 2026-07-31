import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Coffee Menu ── */
const CoffeeMenu: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={880} y={-120} w={400} h={400} fill="var(--ox-accent)" opacity={0.04} />
    <Ellipse x={-60} y={800} w={300} h={300} fill="var(--ox-accent2)" opacity={0.05} />

    {/* Header */}
    <Group x={80} y={60} name="Header">
      <Box x={0} y={0} w={40} h={40} radius={4} fill="var(--ox-accent)" />
      <Text x={0} y={0} w={40} h={40} align="center" valign="center" size={20} weight={300} color="var(--ox-bg)" font="display">L</Text>
      <Text x={56} y={4} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Luxe Café</Text>
      <Text x={56} y={22} w={400} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee &amp; artisanal fare</Text>
    </Group>

    <Line x={80} y={120} w={920} thickness={1} color="var(--ox-accent2)" opacity={0.25} />

    {/* Title */}
    <Text x={80} y={150} w={920} size={40} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Coffee Menu
    </Text>
    <Line x={80} y={208} w={60} thickness={2} color="var(--ox-accent2)" />

    {/* Espresso Section */}
    <Group x={80} y={240} name="Espresso">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Espresso</Text>
      <Text x={0} y={28} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Single Espresso</Text>
      <Text x={460} y={28} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$3.50</Text>
      <Text x={0} y={50} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Single-origin espresso, 30ml pour</Text>

      <Text x={0} y={80} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Double Espresso</Text>
      <Text x={460} y={80} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$4.50</Text>
      <Text x={0} y={102} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Double pour, 60ml — full intensity</Text>

      <Text x={0} y={132} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Macchiato</Text>
      <Text x={460} y={132} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$4.00</Text>
      <Text x={0} y={154} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Espresso with a dollop of steamed milk</Text>
    </Group>

    {/* Milk Section */}
    <Group x={560} y={240} name="Milk Coffee">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Milk Coffee</Text>
      <Text x={0} y={28} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Flat White</Text>
      <Text x={400} y={28} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.00</Text>
      <Text x={0} y={50} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Double espresso, silky microfoam</Text>

      <Text x={0} y={80} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Latte</Text>
      <Text x={400} y={80} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.50</Text>
      <Text x={0} y={102} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Espresso, steamed milk, light foam</Text>

      <Text x={0} y={132} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Cappuccino</Text>
      <Text x={400} y={132} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.00</Text>
      <Text x={0} y={154} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Espresso, steamed milk, thick foam</Text>
    </Group>

    {/* Specialty Section */}
    <Group x={80} y={440} name="Specialty">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Specialty</Text>
      <Text x={0} y={28} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Luxe Cold Brew</Text>
      <Text x={460} y={28} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.50</Text>
      <Text x={0} y={50} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">12-hour steeped, served over ice</Text>

      <Text x={0} y={80} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Honey Lavender Latte</Text>
      <Text x={460} y={80} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$6.50</Text>
      <Text x={0} y={102} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Signature with house-made honey lavender syrup</Text>

      <Text x={0} y={132} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Golden Turmeric Latte</Text>
      <Text x={460} y={132} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$6.00</Text>
      <Text x={0} y={154} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Oat milk, turmeric, ginger, black pepper</Text>
    </Group>

    {/* Footer */}
    <Line x={80} y={1000} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1020} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      All prices include tax — Specialty milks +$0.75
    </Text>
  </>
);
CoffeeMenu.id = 'coffee-menu';
CoffeeMenu.label = 'Coffee Menu';

/* ── Scene 2: Pastry Menu ── */
const PastryMenu: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />
    <Ellipse x={-80} y={-80} w={300} h={300} fill="var(--ox-accent2)" opacity={0.05} />
    <Ellipse x={880} y={700} w={400} h={400} fill="var(--ox-accent)" opacity={0.04} />

    <Group x={80} y={60} name="Header">
      <Box x={0} y={0} w={40} h={40} radius={4} fill="var(--ox-accent)" />
      <Text x={0} y={0} w={40} h={40} align="center" valign="center" size={20} weight={300} color="var(--ox-bg)" font="display">L</Text>
      <Text x={56} y={4} w={400} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Luxe Café</Text>
      <Text x={56} y={22} w={400} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee &amp; artisanal fare</Text>
    </Group>

    <Line x={80} y={120} w={920} thickness={1} color="var(--ox-accent2)" opacity={0.25} />

    <Text x={80} y={150} w={920} size={40} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
      Pastry &amp; Desserts
    </Text>
    <Line x={80} y={208} w={60} thickness={2} color="var(--ox-accent2)" />

    <Group x={80} y={240} name="Pastries">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Viennoiserie</Text>
      <Text x={0} y={28} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Butter Croissant</Text>
      <Text x={460} y={28} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$4.50</Text>
      <Text x={0} y={50} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">French-style, 24-layer laminated dough</Text>

      <Text x={0} y={80} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Chocolate Pain</Text>
      <Text x={460} y={80} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.00</Text>
      <Text x={0} y={102} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Dark chocolate batons in flaky pastry</Text>

      <Text x={0} y={132} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Almond Croissant</Text>
      <Text x={460} y={132} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.50</Text>
      <Text x={0} y={154} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Filled with frangipane, topped with almonds</Text>

      <Text x={0} y={184} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Cinnamon Roll</Text>
      <Text x={460} y={184} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$5.00</Text>
      <Text x={0} y={206} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">House-made with vanilla cream cheese glaze</Text>
    </Group>

    <Group x={560} y={240} name="Desserts">
      <Text x={0} y={0} w={400} size={10} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>Cakes &amp; Desserts</Text>
      <Text x={0} y={28} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">New York Cheesecake</Text>
      <Text x={400} y={28} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$7.00</Text>
      <Text x={0} y={50} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Creamy, dense, classic vanilla</Text>

      <Text x={0} y={80} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Dark Chocolate Tart</Text>
      <Text x={400} y={80} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$7.50</Text>
      <Text x={0} y={102} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">70% cocoa, shortcrust pastry, sea salt</Text>

      <Text x={0} y={132} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Lemon Tart</Text>
      <Text x={400} y={132} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$6.50</Text>
      <Text x={0} y={154} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Citrus curd, toasted meringue</Text>

      <Text x={0} y={184} w={400} size={16} weight={400} color="var(--ox-fg)" font="display">Tiramisu</Text>
      <Text x={400} y={184} w={80} size={15} weight={500} color="var(--ox-accent)" font="body" align="right">$7.50</Text>
      <Text x={0} y={206} w={440} size={11} weight={400} color="var(--ox-muted)" font="body">Espresso-soaked, mascarpone, cocoa</Text>
    </Group>

    <Line x={80} y={1000} w={920} thickness={1} color="var(--ox-muted)" opacity={0.2} />
    <Text x={80} y={1020} w={600} size={10} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      All items baked fresh daily — May contain nuts
    </Text>
  </>
);
PastryMenu.id = 'pastry-menu';
PastryMenu.label = 'Pastry Menu';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Menu',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [CoffeeMenu, PastryMenu] satisfies Scene[];
