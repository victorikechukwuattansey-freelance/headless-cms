import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

/* ── Scene 1: Pitch Deck Cover ── */
const PitchCover: Scene = () => (
  <>
    {/* Full bleed dark background */}
    <Box x={0} y={0} w={1920} h={1080} fill="var(--ox-fg)" />

    {/* Decorative tech shapes */}
    <Ellipse x={1400} y={-200} w={800} h={800} fill="var(--ox-accent)" opacity={0.08} />
    <Ellipse x={-200} y={600} w={600} h={600} fill="var(--ox-accent2)" opacity={0.05} />

    {/* Top accent bar */}
    <Box x={0} y={0} w={1920} h={4} fill="var(--ox-accent2)" />

    {/* Logo */}
    <Group x={80} y={60} name="Logo">
      <Box x={0} y={0} w={32} h={32} radius={8} fill="var(--ox-accent)" />
      <Box x={6} y={6} w={20} h={20} radius={5} fill="var(--ox-accent2)" />
      <Text x={44} y={0} w={300} size={20} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-0.5}>
        NovaTech
      </Text>
      <Text x={44} y={24} w={300} size={9} weight={600} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Solutions
      </Text>
    </Group>

    {/* Hero headline */}
    <Group x={160} y={340} name="Hero">
      <Line x={0} y={0} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={28} w={900} size={80} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Building the
      </Text>
      <Text x={0} y={136} w={900} size={80} weight={700} color="var(--ox-accent2)" font="display" letterSpacing={-2}>
        Future of Tech
      </Text>

      <Line x={0} y={220} w={200} thickness={1} color="var(--ox-accent)" opacity={0.4} />

      <Text x={0} y={248} w={640} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Enterprise-grade solutions for the modern digital landscape. Scalable, secure, and built for growth.
      </Text>
    </Group>

    {/* Bottom info */}
    <Line x={80} y={1020} w={1760} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1040} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
      NovaTech Solutions — 2026
    </Text>
    <Text x={1440} y={1040} w={400} size={12} weight={400} color="var(--ox-muted)" font="body" align="right">
      Confidential
    </Text>
  </>
);
PitchCover.id = 'pitch-cover';
PitchCover.label = 'Pitch Cover';

/* ── Scene 2: About slide (brand page) ── */
const AboutSlide: Scene = () => (
  <>
    <Box x={0} y={0} w={1920} h={1080} fill="var(--ox-bg)" />

    {/* Side accent */}
    <Box x={0} y={0} w={8} h={1080} fill="var(--ox-accent)" />

    <Group x={120} y={160} name="Content">
      <Text x={0} y={0} w={600} size={14} weight={600} color="var(--ox-accent)" font="body" letterSpacing={4} uppercase>
        About
      </Text>

      <Text x={0} y={40} w={800} size={52} weight={700} color="var(--ox-fg)" font="display" letterSpacing={-1.5}>
        Who We Are
      </Text>

      <Line x={0} y={120} w={60} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={160} w={800} size={18} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        NovaTech Solutions delivers enterprise software that transforms how businesses operate. Founded in 2020, we have grown to serve over 200 clients across 12 countries.
      </Text>
      <Text x={0} y={260} w={800} size={18} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Our team of 80 engineers, designers, and strategists is united by a single mission: make technology work for people, not the other way around.
      </Text>
    </Group>

    {/* Stats */}
    <Group x={960} y={340} name="Stats">
      <Box x={0} y={0} w={240} h={120} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={24} w={240} align="center" size={36} weight={700} color="var(--ox-accent)" font="display">200+</Text>
        <Text x={0} y={70} w={240} align="center" size={13} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>Clients</Text>
      </Box>
      <Box x={260} y={0} w={240} h={120} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={24} w={240} align="center" size={36} weight={700} color="var(--ox-accent)" font="display">12</Text>
        <Text x={0} y={70} w={240} align="center" size={13} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>Countries</Text>
      </Box>
      <Box x={0} y={140} w={240} h={120} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={24} w={240} align="center" size={36} weight={700} color="var(--ox-accent)" font="display">80</Text>
        <Text x={0} y={70} w={240} align="center" size={13} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>Team Members</Text>
      </Box>
      <Box x={260} y={140} w={240} h={120} radius={12} fill="var(--ox-surface)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={24} w={240} align="center" size={36} weight={700} color="var(--ox-accent)" font="display">99.9%</Text>
        <Text x={0} y={70} w={240} align="center" size={13} weight={500} color="var(--ox-muted)" font="body" letterSpacing={1}>Uptime</Text>
      </Box>
    </Group>
  </>
);
AboutSlide.id = 'about';
AboutSlide.label = 'About';

/* ── Scene 3: Contact slide ── */
const ContactSlide: Scene = () => (
  <>
    <Box x={0} y={0} w={1920} h={1080} fill="var(--ox-fg)" />

    {/* Top accent */}
    <Box x={0} y={0} w={1920} h={4} fill="var(--ox-accent2)" />

    <Group x={160} y={320} name="Contact">
      <Text x={0} y={0} w={600} size={14} weight={600} color="var(--ox-accent)" font="body" letterSpacing={4} uppercase>
        Get in Touch
      </Text>

      <Text x={0} y={40} w={900} size={64} weight={700} color="var(--ox-bg)" font="display" letterSpacing={-2}>
        Let's Build Together
      </Text>

      <Line x={0} y={140} w={80} thickness={3} color="var(--ox-accent2)" />

      <Text x={0} y={180} w={600} size={18} weight={300} color="var(--ox-muted)" font="body" lineHeight={1.6}>
        Partner with NovaTech and bring your vision to life.
      </Text>

      <Text x={0} y={260} w={400} size={16} weight={400} color="var(--ox-bg)" font="body">
        hello@novatech.solutions
      </Text>
      <Text x={0} y={288} w={400} size={16} weight={400} color="var(--ox-bg)" font="body">
        novatech.solutions
      </Text>
    </Group>

    {/* Footer */}
    <Line x={80} y={1020} w={1760} thickness={1} color="var(--ox-bg)" opacity={0.1} />
    <Text x={80} y={1040} w={400} size={12} weight={400} color="var(--ox-muted)" font="body">
      NovaTech Solutions — 2026
    </Text>
  </>
);
ContactSlide.id = 'contact';
ContactSlide.label = 'Contact';

export const meta: DesignMeta = {
  theme: 'novatech',
  title: 'NovaTech Solutions — Pitch Deck',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1920, h: 1080 };

export default [PitchCover, AboutSlide, ContactSlide] satisfies Scene[];
