# Component Library — AI Social Media OS

**Document:** Component Library & API Specifications  
**Platform:** AI Social Media OS (Buffer-competitive)  
**Tech Stack:** Next.js 14 + Tailwind CSS + shadcn/ui + Radix UI primitives  
**Date:** 2026-07-22  
**Author:** Lead Product Designer

---

## Table of Contents

1. [Primitives](#1-primitives)
2. [Composite](#2-composite)
3. [Platform-specific](#3-platform-specific)
4. [AI-specific](#4-ai-specific)
5. [Analytics](#5-analytics)
6. [Calendar](#6-calendar)
7. [Workflow](#7-workflow)
8. [Data Display](#8-data-display)
9. [Feedback](#9-feedback)
10. [Layout](#10-layout)

---

## 1. Primitives

### Button

**Extends**: Radix `Slot` via `asChild` pattern

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  asChild?: boolean;
}
```

| State | Visual | Notes |
|---|---|---|
| Default | Solid bg for `primary`, border for `outline`, transparent for `ghost` | Min-height 36px (md) |
| Hover | +2 shade darker bg, slight shadow elevation | 150ms transition |
| Active | Scale 0.97, -1 shade darker | 80ms press |
| Focus-visible | 2px primary ring + 4px offset | Always on keyboard nav |
| Disabled | 40% opacity, `cursor-not-allowed` | No hover effects |
| Loading | Spinner replaces icon/text, original width preserved | `aria-busy="true"` |

**Usage guidelines**
- Primary: one per view (CTA)
- Secondary: paired with primary (Cancel, Back)
- Outline: hierarchy between secondary and ghost
- Ghost: toolbars, card actions, subtle controls
- Danger: destructive actions (delete, revoke)
- Link: inline text actions
- Loading state: never change width; use absolute-positioned spinner

---

### Input

```tsx
interface InputProps {
  size: 'sm' | 'md' | 'lg';
  variant: 'default' | 'filled';
  error?: string;
  hint?: string;
  label?: string;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearable?: boolean;
  characterLimit?: number;
}
```

| State | Visual |
|---|---|
| Default | `neutral-200` border, white bg (default variant) or `neutral-100` bg (filled variant) |
| Focus | Primary-500 border, ring-1 primary-500, no offset |
| Hover | `neutral-300` border |
| Error | Error-500 border, error text below, error icon optional |
| Disabled | `neutral-100` bg, `neutral-400` text, no interaction |
| Filled | Shows value, clear button if `clearable` and non-empty |

**Character counter** — bottom-right inside input when `characterLimit` set. Count turns warning-500 at 80%, error-500 at 100%.

---

### Select

```tsx
interface SelectProps {
  items: SelectItem[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  size: 'sm' | 'md' | 'lg';
  error?: string;
  groups?: SelectGroup[];
}

interface SelectItem {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}
```

**Powered by**: Radix `Select` or `Command` (for searchable). Renders as native select on mobile.

**States**: Same as Input. Content is a `Popover` attached to trigger button. Selected item shows in trigger with icon if present.

---

### Checkbox

```tsx
interface CheckboxProps {
  checked: boolean | 'indeterminate';
  size: 'sm' | 'md' | 'lg';
  label?: string;
  description?: string;
  error?: string;
}
```

**Powered by**: Radix `Checkbox`. Animated checkmark draw (150ms) + spring pop (200ms) on check. Indeterminate shown in table header row selection.

| State | Visual |
|---|---|
| Unchecked | `neutral-300` border, transparent bg |
| Checked | Primary-500 bg, white checkmark |
| Indeterminate | Primary-500 bg, white minus icon |
| Disabled | 40% opacity |

---

### Radio

```tsx
interface RadioProps {
  items: { value: string; label: string; description?: string }[];
  value: string;
  orientation: 'horizontal' | 'vertical';
  size: 'sm' | 'md' | 'lg';
}
```

**Powered by**: Radix `RadioGroup`. Vertical for forms, horizontal for inline choices. Outer circle + inner dot animation on selection.

---

### Toggle

```tsx
interface ToggleProps {
  pressed: boolean;
  size: 'sm' | 'md';
  icon?: LucideIcon;
  label?: string;
}
```

Used in toolbars, formatting options. Active state = primary-100 bg + primary-600 text.

---

### Switch

```tsx
interface SwitchProps {
  checked: boolean;
  size: 'sm' | 'md';
  label?: string;
  description?: string;
  showLabel?: 'left' | 'right';
}
```

**Powered by**: Radix `Switch`. Knob slides 24px on toggle (200ms). Background transitions between `neutral-300` (off) and `primary-500` (on).

| State | Visual |
|---|---|
| Off | `neutral-300` track, white knob, left |
| On | `primary-500` track, white knob, right |
| Disabled | 40% opacity |

---

### Textarea

```tsx
interface TextareaProps {
  rows?: number;
  maxRows?: number;
  autoresize?: boolean;
  maxLength?: number;
  showCount?: boolean;
  error?: string;
  placeholder?: string;
  variant?: 'default' | 'minimal';
}
```

Autoresize enabled by default for AI Content Studio. Character count shown bottom-right. Minimal variant used in embedded editors (no border until focus).

---

### Badge

```tsx
interface BadgeProps {
  variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size: 'sm' | 'md' | 'lg';
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}
```

| Variant | Light bg | Dark bg |
|---|---|---|
| default | `neutral-100` text `neutral-700` | `neutral-800` text `neutral-300` |
| primary | `primary-100` text `primary-700` | `primary-900` text `primary-200` |
| success | `success-100` text `success-700` | `success-900` text `success-200` |
| warning | `warning-100` text `warning-700` | `warning-900` text `warning-200` |
| error | `error-100` text `error-700` | `error-900` text `error-200` |

---

### Avatar

```tsx
interface AvatarProps {
  src?: string;
  alt: string;
  fallback: string;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  shape?: 'circle' | 'square';
}
```

| Size | Pixel | | Size | Pixel |
|---|---|---|---|---|
| xs | 20px | lg | 40px |
| sm | 24px | xl | 48px |
| md | 32px | 2xl | 64px |

Fallback shows initials (2 chars max) centered on `neutral-200` bg. Status dot positioned bottom-right, 2px offset. Platform avatar maps to platform icon.

---

### Tooltip

```tsx
interface TooltipProps {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
}
```

**Powered by**: Radix `Tooltip`. Shows after 300ms delay (default). Arrow pointing to trigger. Max-width 200px. Content text only (no HTML). `role="tooltip"`.

---

### Popover

```tsx
interface PopoverProps {
  trigger: ReactNode;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

**Powered by**: Radix `Popover`. For non-critical secondary content (color picker, date quick-select, filter options). Arrow optional.

---

### DropdownMenu

```tsx
interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
}

interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
  submenu?: DropdownMenuItem[];
  onClick: () => void;
}
```

**Powered by**: Radix `DropdownMenu`. Supports nested submenus. Items with `destructive` get `error-500` color text. Keyboard navigation: arrows + Enter. ESC closes.

---

### Dialog

```tsx
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlay?: boolean;
}
```

**Powered by**: Radix `Dialog`. Focus trapped inside. ESC to close. Overlay dismisses by default. Title uses `Dialog.Title` (required for a11y). Description optional.

---

### Sheet

```tsx
interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: 'right' | 'left' | 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'full';
}
```

**Powered by**: Radix `Dialog` (used as sheet). Right-side default. Full-width on mobile. Slide-in animation 300ms `--ease-out`. Backdrop with 50% opacity overlay.

---

### Tabs

```tsx
interface TabsProps {
  tabs: Tab[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'underline' | 'pills' | 'buttons';
}
```

**Powered by**: Radix `Tabs`. Underline variant for page-level navigation. Pills for filter bars. Buttons for segmented controls. Active indicator animates between tabs.

---

### Accordion

```tsx
interface AccordionProps {
  items: AccordionItem[];
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string;
}
```

**Powered by**: Radix `Accordion`. Chevron rotates on expand (180deg, 200ms). Content area slides down (height animation). Used in settings, FAQ, node properties panels.

---

## 2. Composite

### DataTable

```tsx
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

interface ColumnDef<T> {
  id: string;
  header: string | ReactNode;
  accessorKey?: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
}
```

**Powered by**: `@tanstack/react-table`. Features pagination with page size selector, column sorting (click header), multi-row selection with checkbox column (indeterminate header), text search filter, resizable columns via drag handle on header borders.

**States:**

| State | Display |
|---|---|
| Default | Striped rows (neutral-50 on even), hover highlight (neutral-100) |
| Loading | Skeleton rows (5 rows, shimmer animation) |
| Empty | Full-width `EmptyState` with configurable message + icon |
| Error | Error state with retry button |
| Selected | Row has primary-50 bg, checkbox filled |

---

### FormField

```tsx
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  layout?: 'vertical' | 'horizontal';
}
```

Wraps label + input + error + hint in a consistent layout. Horizontal layout for settings forms (label left, input right). Error message uses `role="alert"`, linked via `aria-describedby`. Hint shows below input in neutral-500.

---

### Card

```tsx
interface CardProps {
  variant?: 'default' | 'elevated' | 'bordered' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
```

| Variant | Style |
|---|---|
| default | neutral-100 bg, subtle shadow |
| elevated | white bg, shadow-md |
| bordered | white bg, neutral-200 border, no shadow |
| flat | neutral-50 bg, no border/shadow |

`hoverable` adds hover state: shadow elevation increase, `translateY(-2px)`, cursor pointer.

---

### PageHeader

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  tabs?: Tab[];
  onTabChange?: (value: string) => void;
}
```

Top of every page. Shows breadcrumb (optional), title, description (optional), action buttons slot (right-aligned). When tabs present, renders `<Tabs>` below title.

---

### SidebarNav

```tsx
interface SidebarNavProps {
  items: SidebarNavItem[];
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarNavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number | string;
  active?: boolean;
  disabled?: boolean;
  children?: SidebarNavItem[];
}
```

Collapsible navigation with expandable sections. Active item highlighted with `primary-100` bg + primary-600 text + left border accent (3px). Badge shown right-aligned for counts. Tooltip on collapsed state.

---

### CommandPalette

```tsx
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandItem[];
  recentCommands?: string[];
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  category?: string;
  keywords?: string[];
  onClick: () => void;
}
```

**Shortcut**: `Cmd+K` globally. Powered by Radix `Command` (`cmdk`). Fuzzy search across labels, descriptions, keywords. Groups by category. Shows recent items first. Keyboard navigation with arrows, Enter to select.

---

### MultiSelect

```tsx
interface MultiSelectProps {
  items: SelectItem[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  creatable?: boolean;
}
```

Combobox that allows multiple selections. Selected items shown as removable badges inside the trigger. Dropdown with checkboxes. `creatable` allows typing new values (used for tags). Used in platform selectors, tag inputs, filter bars.

---

### DatePicker

```tsx
interface DatePickerProps {
  value: Date | [Date, Date] | undefined;
  onChange: (date: Date | [Date, Date] | undefined) => void;
  mode: 'single' | 'range' | 'multiple';
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  placeholder?: string;
}
```

**Powered by**: `react-day-picker`. Renders inline in a Popover. Range mode for date range selection (campaign duration, analytics period). Quick presets: "Today", "Tomorrow", "Next Week", "Next Month".

---

### ColorPicker

```tsx
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presetColors?: string[];
  showInput?: boolean;
}
```

Swatch grid with presets (20 colors) + custom input (hex). Used in brand voice settings for brand color palette. Eye-dropper support where browser allows.

---

### TagInput

```tsx
interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  validate?: (tag: string) => boolean;
}
```

Type text → press Enter/comma → creates tag as removable badge. Backspace on empty input removes last tag. Suggestions dropdown when typing. Duplicate prevention. Used in forbidden words, approved terms, content tags.

---

### FileUpload

```tsx
interface FileUploadProps {
  accept: string[];
  maxSize?: number; // MB
  maxFiles?: number;
  value: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  dropzoneText?: string;
  preview?: boolean;
}
```

Drag-and-drop zone with click-to-browse fallback. Shows file previews (thumbnail for images, icon for documents). Progress bar during upload. Error state for invalid type/size. Used in media attachment, brand assets.

---

### SortableList

```tsx
interface SortableListProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  handle?: boolean;
}
```

**Powered by**: `@dnd-kit/core` + `@dnd-kit/sortable`. Drag handle on left (6 dots icon). Items animate to new positions on drop. Used in queue reordering, playlist arrangement.

---

### RichTextEditor

```tsx
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  toolbar?: ToolbarGroup[];
  mentionable?: Mentionable[];
  characterLimit?: number;
}

type ToolbarGroup = 'formatting' | 'heading' | 'list' | 'link' | 'media' | 'emoji' | 'ai';
```

**Powered by**: Tiptap (ProseMirror wrapper). Toolbar appears on focus (desktop) or always visible (mobile). Supports: bold, italic, underline, strikethrough, H1-H3, bullet list, ordered list, blockquote, link, image embed, emoji picker, @ mentions. Character count in bottom-right. `/` command menu for AI actions (inline generate, improve, translate).

---

## 3. Platform-specific

### PlatformIcon

```tsx
interface PlatformIconProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  colored?: boolean;
}

type Platform = 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'facebook'
  | 'youtube' | 'pinterest' | 'threads' | 'bluesky' | 'mastodon'
  | 'whatsapp' | 'telegram';
```

Renders brand SVG icon. `colored` applies brand color; otherwise inherits `currentColor`. Always square. Loading state: skeleton circle of same size.

---

### PlatformBadge

```tsx
interface PlatformBadgeProps {
  platform: Platform;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  status?: 'connected' | 'disconnected' | 'error';
}
```

Small badge combining PlatformIcon + platform name. Color-coded dot for connection status. Used on post cards, account list, feed items.

---

### PlatformSelector

```tsx
interface PlatformSelectorProps {
  platforms: Platform[];
  selected: Platform[];
  onChange: (selected: Platform[]) => void;
  size?: 'sm' | 'md';
  max?: number;
}
```

Horizontal row of toggle-able platform chips. Each chip shows PlatformIcon + name. Selected chips have primary bg. Disabled platforms show as dimmed if at max. Used in Content Studio, Repurposing Engine.

---

### AccountCard

```tsx
interface AccountCardProps {
  platform: Platform;
  accountName: string;
  avatar?: string;
  followers?: number;
  status: 'active' | 'expired' | 'error';
  onReconnect?: () => void;
  onSwitch?: () => void;
}
```

Card showing platform icon, account avatar, name, follower count. Status indicator color (green/yellow/red). "Reconnect" button on error/expired. Used in Dashboard sidebar, Settings > Integrations.

---

## 4. AI-specific

### AIPromptInput

```tsx
interface AIPromptInputProps {
  onSubmit: (prompt: string) => void;
  placeholder?: string;
  context?: string;
  suggestions?: string[];
  loading?: boolean;
  disabled?: boolean;
}
```

Expandable text input with context-aware suggestions. Shows suggestion chips (3-4) below input based on current page context. Menu button for advanced options (tone, length, format). Cmd+Enter to submit. Character count.

| State | Display |
|---|---|
| Default | Placeholder text, suggestion chips |
| Focus | Subtle glow border (secondary-400), suggestion chips visible |
| Filled | Clear button appears, live character count |
| Loading | Spinner replaces submit button, input disabled |
| Disabled | 40% opacity |

---

### AIGenerationPanel

```tsx
interface AIGenerationPanelProps {
  results: GenerationResult[];
  onApply: (result: GenerationResult) => void;
  onRegenerate?: () => void;
  onEdit?: (result: GenerationResult) => void;
  loading?: boolean;
  error?: string;
}

interface GenerationResult {
  id: string;
  content: string;
  score?: number;
  platform?: Platform;
  metrics?: { chars: number; images: number; estimatedReadTime: number };
}
```

Shows AI-generated content variants (2-3 options). Each result card has: score badge, content preview (2-line clamp, expandable), platform indicator, action buttons (Apply, Edit, Regenerate). Loading state: 3 skeleton cards with shimmer.

---

### AISuggestionCard

```tsx
interface AISuggestionCardProps {
  title: string;
  description: string;
  type: 'content' | 'improve' | 'repurpose' | 'schedule' | 'insight';
  icon?: LucideIcon;
  onApply: () => void;
  onDismiss: () => void;
  dismissed?: boolean;
}
```

Used in Dashboard right panel, Analytics insights. Card with icon (left), title + description (center), action buttons (right). `dismissed` state collapses card with fade animation. Types have distinct icon/bg colors.

---

### ContentScoreBadge

```tsx
interface ContentScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBreakdown?: boolean;
}
```

Circular badge showing score (0-100). Color: <50 = error-500, 50-69 = warning-500, 70-84 = primary-500, 85+ = success-500. Animated fill on mount (stroke-dashoffset animation). `showBreakdown` tooltip with per-criteria scores (clarity, engagement potential, length, platform fit).

---

### ToneSelector

```tsx
interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
  presets?: TonePreset[];
}

interface TonePreset {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}
```

Horizontal chip selector with icons. Default presets: Professional, Casual, Humorous, Authoritative, Empathetic, Inspirational, Custom. Selected chip has secondary-500 bg. Custom opens Brand Voice selector.

---

### BrandVoiceIndicator

```tsx
interface BrandVoiceIndicatorProps {
  active: boolean;
  name: string;
  traits: string[];
  onSwitch?: () => void;
}
```

Small badge in Content Studio header showing active brand voice profile. Color dot (green if active), name, trait pills (2 max, truncated). Click to open voice switcher dropdown.

---

### ModelSelector

```tsx
interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  models: ModelOption[];
  size?: 'sm' | 'md';
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  speed: 'fast' | 'balanced' | 'quality';
  cost: number; // credits per generation
}
```

Dropdown select showing AI model options grouped by provider (OpenAI, Anthropic, Meta, etc.). Each option shows name, speed indicator (lightning bolt icons: 1=fast, 2=balanced, 3=quality), cost in credits. Hover shows full description.

---

## 5. Analytics

### StatCard

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    period: string;
  };
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
}
```

Compact KPI card. Value displayed large (`--text-3xl`). Trend shown as small colored pill (green up, red down, gray neutral) with arrow icon + percentage + period. Clickable to navigate to detail.

| State | Visual |
|---|---|
| Default | Elevated card, centered value, trend below |
| Loading | Skeleton block matching card dimensions |
| Clickable | Hover shadow increase, cursor pointer |

---

### ChartContainer

```tsx
interface ChartContainerProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  height?: number;
}
```

Standard wrapper for all charts. Provides title, description, action slot (download, fullscreen, filter). Loading state: skeleton of chart height. Error state: error message + retry button. Responsive: height defaults to 300px (desktop), 250px (mobile).

---

### TimeRangeSelector

```tsx
interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  presets?: TimeRangePreset[];
  showCustom?: boolean;
}

type TimeRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';
type TimeRange = { preset: TimeRangePreset; start?: Date; end?: Date };
```

Segmented button group of preset options. "Custom" opens a DatePicker (range mode). Active preset has primary-500 bg. Animated indicator between segments.

---

### MetricComparison

```tsx
interface MetricComparisonProps {
  label: string;
  current: number;
  previous: number;
  format?: 'number' | 'percentage' | 'currency' | 'abbreviated';
  goodWhen?: 'up' | 'down';
}
```

Side-by-side comparison showing current vs previous period. Arrow indicator (green up / red down). Delta percentage. Bar visualization comparing two values (mini progress bar).

---

### InsightCard

```tsx
interface InsightCardProps {
  type: 'positive' | 'negative' | 'neutral' | 'action';
  title: string;
  description: string;
  metric?: { label: string; value: string };
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}
```

AI-generated insight card. Type determines icon + left border color (green/red/gray/blue). Action button for "Apply recommendation". Dismiss button. Used in Analytics AI Insights panel.

---

## 6. Calendar

### CalendarView

```tsx
interface CalendarViewProps {
  mode: 'month' | 'week' | 'day';
  date: Date;
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
  onEventDrop?: (event: CalendarEvent, newDate: Date) => void;
  optimalTimes?: OptimalTime[];
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  platform: Platform;
  status: 'draft' | 'scheduled' | 'published';
  color?: string;
}
```

**Month view**: 7-column grid, each cell shows truncated event list + "+N more". Current day highlighted with primary ring. Events colored by platform.

**Week view**: 7-column grid, each day column with time slots on left (9am-6pm). Events as blocks spanning time.

**Day view**: Single column with 15-minute time slots (7am-10pm). Events as positioned blocks.

**Drag and drop**: Powered by `@dnd-kit`. Events can be dragged between dates/slots. Drag preview shows original position as ghost.

**Optimal times**: Green overlay dots/circles on cells/slots where AI recommends posting. Tooltip shows expected engagement lift.

---

### CalendarEvent (Component)

```tsx
interface CalendarEventProps {
  event: CalendarEvent;
  view: 'month' | 'week' | 'day';
  selected?: boolean;
  onClick?: () => void;
  onDrag?: () => void;
}
```

Renders inside calendar cells. Month: small pill with platform dot + title. Week/day: time block with platform color, title, status icon. Selected state: ring + shadow.

---

### DragHandle

```tsx
interface DragHandleProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
}
```

6-dot grip icon. Appears on hover of draggable items. Larger tap target on mobile (44px). Cursor changes to `grab` / `grabbing`. Used on calendar events, sortable list items.

---

### TimeSlot

```tsx
interface TimeSlotProps {
  time: string;
  date: Date;
  isOptimal?: boolean;
  isCurrent?: boolean;
  onClick?: () => void;
}
```

Empty time slot in week/day view. `isOptimal` shows green tint + sparkle icon. `isCurrent` shows a subtle indicator line for current time. Click to create new event.

---

## 7. Workflow

### WorkflowCanvas

```tsx
interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onNodeClick?: (node: WorkflowNode) => void;
  onCanvasClick?: () => void;
  onDrop?: (nodeType: string, position: Position) => void;
  readOnly?: boolean;
}
```

**Powered by**: React Flow (`reactflow`). Infinite panning surface with dot-grid background. Zoom range: 25%–200%. Snap-to-grid on drag (20px grid). Mini-map in bottom-right corner. Controls (zoom in/out, fit view, lock) in bottom-left.

| State | Behavior |
|---|---|
| Empty | Centered placeholder: "Drag nodes here to start" |
| Editing | Nodes connected, selection box on shift+drag |
| Read-only | Pan/zoom only, no interaction |
| Running | Animated edges (flowing dots), pulsing active node |

---

### NodeBlock

```tsx
interface NodeBlockProps {
  title: string;
  icon: LucideIcon;
  type: 'trigger' | 'action' | 'condition';
  selected?: boolean;
  configurable?: boolean;
  error?: boolean;
  running?: boolean;
  children?: ReactNode;
}
```

Base node component. All nodes have: header (icon + title + status dot), body (configuration summary, 2 lines max), input port (top), output port (bottom). Condition nodes have ports on left (true) and right (false).

| Variant | Border | Header bg |
|---|---|---|
| Trigger | `success-500` (2px) | `success-50` (light) / `success-900` (dark) |
| Action | `primary-500` | `primary-50` / `primary-900` |
| Condition | `warning-500` | `warning-50` / `warning-900` (diamond shape) |

---

### ConnectionLine

```tsx
interface ConnectionLineProps {
  animated?: boolean;
  selected?: boolean;
  error?: boolean;
  style?: 'solid' | 'dashed';
}
```

Bezier curve between source output port and target input port. Animated dot flow when workflow is active/running (CSS animation, 1s loop). Selected: thicker line, primary-500. Error: dashed red line.

---

### TriggerNode

```tsx
interface TriggerNodeProps {
  type: 'schedule' | 'webhook' | 'platform_event' | 'manual';
  config: {
    schedule?: string; // cron expression
    webhookUrl?: string;
    event?: string;
  };
  status: 'active' | 'paused' | 'error';
}
```

Green-bordered node. Schedule type shows cron description ("Every day at 9am"). Webhook type shows URL (truncated). Platform event shows event name. Status indicator in header.

---

### ActionNode

```tsx
interface ActionNodeProps {
  type: 'generate' | 'publish' | 'analyze' | 'webhook' | 'ai_transform' | 'slack' | 'email';
  config: Record<string, any>;
  lastRun?: { status: 'success' | 'failure'; timestamp: Date };
}
```

Blue-bordered node. Body shows action-specific summary (e.g., "Publish to IG, 𝕏, LI" for publish type). Last run status shown as checkmark/X with timestamp below body.

---

### ConditionNode

```tsx
interface ConditionNodeProps {
  expression: string;
  mode: 'ai_decision' | 'threshold' | 'contains';
}
```

Orange diamond-shaped node (CSS clip-path or SVG). Top port = input. Left port = true (label: "Yes"). Right port = false (label: "No"). Expression shown in center (e.g., "Score > 80").

---

### NodePalette

```tsx
interface NodePaletteProps {
  categories: NodeCategory[];
  onDragStart: (nodeType: string, event: DragEvent) => void;
}

interface NodeCategory {
  label: string;
  icon: LucideIcon;
  nodes: PaletteNode[];
}

interface PaletteNode {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
}
```

Collapsible categories: Triggers, Content, AI, Publishing, Analytics, Webhooks, Notifications. Each node item is a draggable row. Drag preview shows node icon + label. Search filter at top for filtering across all categories.

---

### ExecutionLog

```tsx
interface ExecutionLogProps {
  runs: RunEntry[];
  loading?: boolean;
  onSelect: (runId: string) => void;
  onRetry?: (runId: string) => void;
  filter?: 'all' | 'success' | 'failure' | 'running';
}

interface RunEntry {
  id: string;
  status: 'success' | 'failure' | 'running' | 'pending';
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  steps: RunStep[];
  error?: string;
}
```

Bottom panel showing workflow execution history. Expandable rows per run. Each run shows: status icon, timestamp, duration, step count (e.g., "3/4 completed"). Click to expand step-by-step breakdown. Error rows have red indicator + error message + retry button. Auto-refresh during active runs.

---

## 8. Data Display

### EmptyState

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}
```

Centered layout with large icon (48px), title (text-xl), description (text-sm, neutral-500), optional primary + secondary action buttons. Fade-in animation on mount. Used across all list views with no data.

### LoadingState

```tsx
interface LoadingStateProps {
  variant: 'spinner' | 'skeleton' | 'shimmer';
  rows?: number;
  height?: number;
}
```

- `spinner`: Centered rotating loader (for full-page loads)
- `skeleton`: Rectangle blocks mimicking content shape (for partial updates)
- `shimmer`: Skeleton with animated gradient sweep (for initial loads)

---

### ErrorState

```tsx
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: 'inline' | 'block' | 'fullscreen';
}
```

| Variant | Display |
|---|---|
| inline | Small red text, inline with content |
| block | Card with error icon + message + retry, within content flow |
| fullscreen | Centered hero layout, full page height |

---

### Skeleton

```tsx
interface SkeletonProps {
  variant: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  count?: number;
  className?: string;
}
```

Animated placeholder (shimmer: neutral-200 to neutral-100 sweep). Text variant = block with rounded corners. Circular = avatar-shaped. Rectangular = card/chart shaped. `count` renders multiple stacked skeletons.

---

### InfiniteScroll

```tsx
interface InfiniteScrollProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  loader?: ReactNode;
  endMessage?: ReactNode;
  threshold?: number;
  children: ReactNode;
}
```

Intersection Observer-based. Loads more content when sentinel element enters viewport (default: 200px before end). Shows spinner at bottom during load. End message when `hasMore` is false. Used in Engagement Inbox, Content Library.

---

### VirtualList

```tsx
interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  overscan?: number;
  height?: number;
}
```

**Powered by**: `@tanstack/react-virtual`. Renders only visible items + overscan buffer. Fixed or variable item heights. Used for large lists (1000+ items) in analytics logs, execution logs, content library (list view).

---

## 9. Feedback

### Toast

```tsx
interface ToastProps {
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
  duration?: number;
  dismissible?: boolean;
}
```

**Powered by**: `sonner` or Radix `Toast`. Stacked at top-right (desktop), top-center (mobile). Auto-dismiss by default (5s). Hover pauses dismiss timer. Action button for undo/retry. Success = green left border, error = red, etc.

| Variant | Icon |
|---|---|
| success | CheckCircle |
| error | XCircle |
| warning | AlertTriangle |
| info | Info |

---

### Banner

```tsx
interface BannerProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  onDismiss?: () => void;
}
```

Full-width banner below top bar. Used for system messages (plan limits, connectivity issues, feature announcements). Dismissible ones persist in localStorage. Action button for immediate fix.

---

### Alert

```tsx
interface AlertProps {
  variant: 'info' | 'warning' | 'error' | 'success' | 'destructive';
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}
```

Inline alert within content. Left border + icon + title + description + optional action buttons. Used in forms (validation summary), settings pages (permissions info), workflow configuration (missing fields).

---

### ProgressBar

```tsx
interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  indeterminate?: boolean;
}
```

Fill bar with rounded ends. `animated` enables gradient sweep animation on the fill. `indeterminate` shows continuous animation for unknown duration tasks. `showLabel` displays percentage inside or beside bar.

---

### Stepper

```tsx
interface StepperProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'numbers' | 'icons' | 'dots';
}

interface Step {
  label: string;
  description?: string;
  icon?: LucideIcon;
  status: 'completed' | 'current' | 'upcoming' | 'error';
}
```

**Horizontal**: Used in Campaign Builder, Onboarding. Each step shows number/icon + label below. Connecting lines between steps. Completed = green check + line filled. Current = primary circle, pulsing. Error = red X.

**Vertical**: Used in wizard forms (settings, workflow configuration). Steps on left, content on right.

---

### Modal

```tsx
// Alias for Dialog — see Dialog in Primitives (Section 1)
// Extended for specific use cases:
```

**ConfirmModal**: Pre-configured Dialog with title + description + Cancel/Confirm buttons.
**FormModal**: Dialog with form fields inside, Cancel/Save buttons in footer.

---

## 10. Layout

### AppShell

```tsx
interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}
```

Root layout component. Manages sidebar + topbar + content + optional right panel. Responsive: sidebar collapses to bottom nav on mobile. Uses CSS Grid layout:

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--topbar-height) 1fr;
  grid-template-areas:
    "sidebar topbar"
    "sidebar content";
}
```

---

### Sidebar

```tsx
interface SidebarProps {
  items: SidebarNavItem[];
  collapsed?: boolean;
  onToggle?: () => void;
  workspaceSwitcher?: ReactNode;
  bottomContent?: ReactNode; // user menu, settings
}
```

260px / 64px (collapsed). Primary navigation + workspace switcher + user section. Scrolls independently. Transitions width with 300ms ease. On mobile (<md): renders as BottomNav.

---

### TopBar

```tsx
interface TopBarProps {
  title?: string;
  breadcrumb?: BreadcrumbItem[];
  search?: ReactNode;
  actions?: ReactNode;
  userMenu?: ReactNode;
  mobileMenuTrigger?: ReactNode;
}
```

56px fixed height. Left: breadcrumb or page title. Center-right: global search (Cmd+K). Right: AI credit badge, notification bell, user avatar dropdown. Bottom border separates from content.

---

### Panel

```tsx
interface PanelProps {
  title: string;
  variant?: 'sidebar' | 'floating' | 'overlay';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onCollapse?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}
```

Content container for right panels, side panels. `sidebar` variant: fixed position, left/right border. `floating`: elevated card with shadow, positioned absolute. `overlay`: slides over content with backdrop.

---

### SplitPane

```tsx
interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultRatio?: number; // 0.6 = 60/40
  minLeft?: number; // px
  minRight?: number; // px
  direction?: 'horizontal' | 'vertical';
  onResize?: (ratio: number) => void;
}
```

Two resizable panels. Horizontal split for Content Studio. Vertical split for Workflow Builder (canvas + execution log). State persisted via URL params. Collapsible via double-click handle.

---

### ResizeHandle

```tsx
interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}
```

6px wide strip between panels. Hover: cursor `col-resize` / `row-resize`, background highlight (primary-200). Active: thicker handle. Double-click to collapse/expand neighbor panel. Keyboard: focus handle → Arrow keys to resize.

---

*End of Component Library document.*
