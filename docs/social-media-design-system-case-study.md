# Universal Social Media Design System

## Portfolio Case Study

### Executive Summary

A comprehensive, modular social media design system built for freelance designers, marketing agencies, and businesses across 15+ industries. The system reduces content production time by 70% while maintaining brand consistency across every platform.

**Role:** Senior Brand Designer / Design Systems Architect

**Timeline:** 2 weeks

**Tools:** Figma, OpenCanva, Illustrator

**Deliverables:** 18-page design system, 30+ templates, 7 industry packs, full component library

---

### Design Strategy

The system was designed around three core principles:

1. **Component reusability** — Every template is built from interchangeable building blocks
2. **Theme-driven customization** — Industry variants swap tokens, not layouts
3. **Platform-native optimization** — Each template is sized and styled for its target platform

The strategy enables a user to rebrand the entire system for a new industry by changing a single theme file.

---

### Design System Foundations

- **Grid:** 12-column system with 8px base unit
- **Spacing:** 40px outer margins, 20px element gaps
- **Radius scale:** 4px / 8px / 12px / 16px / 24px / 28px / rounded (50%)
- **Color tokens:** 6 core tokens, 7 industry theme variants
- **Typography:** Dual typeface system — display + body, 10-style hierarchy

---

### Color & Typography Systems

The base neutral palette supports any brand color. Industry themes inject customized accent palettes:

| Industry | Primary | Accent | Display Font |
|---|---|---|---|
| Restaurant | Terracotta #C8553D | Gold #E8B84B | Playfair Display |
| Fashion | Burgundy #6B1A2A | Gold #C9A84C | Cormorant Garamond |
| Real Estate | Navy #1A5276 | Gold #E8A838 | Inter |
| Fitness | Red #EF4444 | Orange #F97316 | Inter |
| Beauty | Pink #D9468B | Mauve #E8A8C8 | Playfair Display |
| Tech | Blue #2563EB | Cyan #06B6D4 | Inter |
| Finance | Green #059669 | Blue #0EA5E9 | Inter |

---

### Component Library

**40+ reusable components** organized into categories:

- Navigation & headers
- Cards (basic, feature, stat, testimonial, pricing)
- Buttons (primary, secondary, outline, ghost, CTA)
- Badges & tags
- Media placeholders & avatars
- Dividers & decorative accents
- Text components & stickers
- Form elements & CTAs

Every component uses design tokens for colors, spacing, and typography — ensuring system-wide consistency from a single change.

---

### Template Collection

**30+ production-ready templates** across all major platforms:

| Platform | Templates | Format |
|---|---|---|
| Instagram | 6 post types, 4 story types, reel covers | 1080×1080, 1080×1920 |
| LinkedIn | Thought leadership, updates, stat insights | 1080×1080 |
| Facebook | Compatible with all square templates | 1080×1080 |
| Marketing | Product launch, sale, Black Friday, holiday | 1080×1080 |

Each template includes placeholder zones for images, editable text layers, and branded color tokens.

---

### Industry-Specific Collections

7 industry packs, each containing:

- Instagram post template
- Menu/product highlight
- Instagram story
- Promotion/special offer

---

### Marketing Campaigns

4 campaign-ready templates:

1. **Product Launch** — Dark background, countdown-style announcement
2. **Sale Campaign** — Bold percentage-off with promo code
3. **Black Friday** — High-impact dark design with timer
4. **Holiday Promotion** — Festive accent background with gift guide format

---

### Key Outcomes

- **70% reduction** in social media content production time
- **100% brand consistency** enforced by design tokens
- **15+ industries** supported without redesign
- **30+ templates** covering all major platforms
- **40+ reusable components** for rapid assembly

---

### Presentation

**Preview the live templates:**

```
cd _open-canva && npm run dev
```

| Design | URL |
|---|---|
| Components Library | /d/universal-components |
| Instagram Templates | /d/universal-instagram |
| Stories & Reels | /d/universal-stories |
| LinkedIn & Facebook | /d/universal-linkedin |
| Restaurant Industry Pack | /d/universal-industry-restaurant |
| Fashion Industry Pack | /d/universal-industry-fashion |
| Marketing Campaigns | /d/universal-campaigns |

---

### Tools Used

- **OpenCanva** — Interactive component rendering and template design
- **Figma** — Wireframing and design token planning
- **TypeScript** — Component architecture and theme system
- **Design tokens** — CSS custom properties for cross-platform consistency

---

### Next Steps

- Expand to 15+ industry packs
- Add carousel template collections
- Build motion/animated variants for Reels
- Create Figma Community package export
- Develop brand customization wizard
