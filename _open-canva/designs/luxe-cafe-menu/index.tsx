import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Menu Board ── */
const MenuBoard: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-bg)" />

    {/* Decorative */}
    <Ellipse x={800} y={-120} w={500} h={500} fill="var(--ox-accent2)" opacity={0.04} />

    {/* Header */}
    <Group x={80} y={60} name="Header">
      <Box x={0} y={0} w={32} h={26} radius={4} fill="var(--ox-accent)" />
      <Box x={4} y={5} w={24} h={16} radius={2} fill="var(--ox-accent2)" />
      <Box x={10} y={30} w={12} h={8} radius={2} fill="var(--ox-accent)" />
      <Text x={44} y={0} w={400} size={28} weight={700} color="var(--ox-fg)" font="display">Luxe Café</Text>
      <Text x={44} y={34} w={400} size={11} weight={500} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>Menu</Text>
    </Group>

    {/* Divider */}
    <Line x={80} y={120} w={920} thickness={2} color="var(--ox-accent2)" opacity={0.4} />

    {/* Coffee section */}
    <Group x={80} y={160} name="Coffee Section">
      <Text x={0} y={0} w={400} size={13} weight={700} color="var(--ox-accent)" font="display" letterSpacing={2} uppercase>
        Coffee
      </Text>

      <Group x={0} y={28} name="Item 1">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Espresso</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$3.50</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Single origin · rich & bold</Text>
      </Group>

      <Group x={0} y={68} name="Item 2">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Cappuccino</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$4.50</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Espresso · steamed milk · foam</Text>
      </Group>

      <Group x={0} y={108} name="Item 3">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Flat White</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$4.50</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Double espresso · silky milk</Text>
      </Group>

      <Group x={0} y={148} name="Item 4">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Latte</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$4.00</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Espresso · steamed milk</Text>
      </Group>

      <Group x={0} y={188} name="Item 5">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Pour Over</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$5.00</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Single origin · hand-brewed</Text>
      </Group>
    </Group>

    {/* Pastry section */}
    <Group x={80} y={420} name="Pastry Section">
      <Text x={0} y={0} w={400} size={13} weight={700} color="var(--ox-accent)" font="display" letterSpacing={2} uppercase>
        Pastry
      </Text>

      <Group x={0} y={28} name="PItem 1">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Croissant</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$4.00</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Butter · flaky · golden</Text>
      </Group>

      <Group x={0} y={68} name="PItem 2">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Pain au Chocolat</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$4.50</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Dark chocolate · butter pastry</Text>
      </Group>

      <Group x={0} y={108} name="PItem 3">
        <Text x={0} y={0} w={400} size={15} weight={600} color="var(--ox-fg)" font="body">Cinnamon Roll</Text>
        <Text x={680} y={0} w={100} size={15} weight={600} color="var(--ox-accent2)" font="body" align="right">$5.00</Text>
        <Text x={0} y={22} w={600} size={12} weight={400} color="var(--ox-muted)" font="body">Cream cheese icing · warm spice</Text>
      </Group>
    </Group>

    {/* Bottom accent */}
    <Box x={0} y={1070} w={1080} h={10} fill="var(--ox-accent2)" opacity={0.6} />
  </>
);
MenuBoard.id = 'menu-board';
MenuBoard.label = 'Menu Board';

/* ── Scene 2: Specialty Drinks ── */
const SpecialtyDrinks: Scene = () => (
  <>
    <Box x={0} y={0} w={1080} h={1080} fill="var(--ox-accent)" />

    <Ellipse x={-100} y={-100} w={400} h={400} fill="var(--ox-bg)" opacity={0.04} />
    <Ellipse x={800} y={700} w={500} h={500} fill="var(--ox-bg)" opacity={0.04} />

    <Group x={80} y={100} name="Header">
      <Box x={0} y={0} w={28} h={22} radius={3} fill="var(--ox-accent2)" opacity={0.8} />
      <Box x={4} y={4} w={20} h={14} radius={2} fill="var(--ox-bg)" />
      <Box x={9} y={26} w={10} h={6} radius={2} fill="var(--ox-accent2)" opacity={0.8} />
      <Text x={40} y={0} w={400} size={22} weight={700} color="var(--ox-bg)" font="display">Luxe Café</Text>
    </Group>

    <Group x={80} y={200} name="Specialty">
      <Text x={0} y={0} w={920} size={14} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={4} uppercase>
        Specialty
      </Text>

      <Text x={0} y={40} w={920} size={52} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-1.5}>
        Seasonal
      </Text>
      <Text x={0} y={108} w={920} size={44} weight={600} color="var(--ox-accent2)" font="display" letterSpacing={-1}>
        Creations
      </Text>

      <Line x={0} y={180} w={60} thickness={3} color="var(--ox-accent2)" />

      <Group x={0} y={212} name="Item 1">
        <Text x={0} y={0} w={400} size={17} weight={600} color="var(--ox-bg)" font="body">Honey Lavender Latte</Text>
        <Text x={600} y={0} w={150} size={17} weight={600} color="var(--ox-accent2)" font="body" align="right">$5.50</Text>
        <Text x={0} y={24} w={600} size={13} weight={300} color="var(--ox-bg)" font="body" opacity={0.8}>Espresso · honey · lavender · oat milk</Text>
        <Line x={0} y={48} w={750} thickness={1} color="var(--ox-bg)" opacity={0.1} />
      </Group>

      <Group x={0} y={288} name="Item 2">
        <Text x={0} y={0} w={400} size={17} weight={600} color="var(--ox-bg)" font="body">Brown Sugar Shaken Espresso</Text>
        <Text x={600} y={0} w={150} size={17} weight={600} color="var(--ox-accent2)" font="body" align="right">$5.00</Text>
        <Text x={0} y={24} w={600} size={13} weight={300} color="var(--ox-bg)" font="body" opacity={0.8}>Brown sugar · cinnamon · shaken</Text>
        <Line x={0} y={48} w={750} thickness={1} color="var(--ox-bg)" opacity={0.1} />
      </Group>

      <Group x={0} y={364} name="Item 3">
        <Text x={0} y={0} w={400} size={17} weight={600} color="var(--ox-bg)" font="body">Matcha & Coconut Latte</Text>
        <Text x={600} y={0} w={150} size={17} weight={600} color="var(--ox-accent2)" font="body" align="right">$5.50</Text>
        <Text x={0} y={24} w={600} size={13} weight={300} color="var(--ox-bg)" font="body" opacity={0.8}>Ceremonial matcha · coconut milk · honey</Text>
        <Line x={0} y={48} w={750} thickness={1} color="var(--ox-bg)" opacity={0.1} />
      </Group>
    </Group>
  </>
);
SpecialtyDrinks.id = 'specialty-drinks';
SpecialtyDrinks.label = 'Specialty Drinks';

export const meta: DesignMeta = {
  theme: 'luxecafe',
  title: 'Luxe Café — Menu',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [MenuBoard, SpecialtyDrinks] satisfies Scene[];
