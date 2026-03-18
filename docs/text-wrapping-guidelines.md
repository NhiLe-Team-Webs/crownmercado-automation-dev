# Text Wrapping & Orphaned Text Prevention Guide

## Problem

Orphaned text occurs when:
- A single character appears on its own line
- A single short word appears on its own line, breaking the visual flow
- Vietnamese text gets incorrectly wrapped due to CSS properties

## Solution

### 1. **Import & Use Smart Text Wrapper**

All text overlay components should use the `smart-text-wrapper` utility:

```tsx
import { preventOrphanLines, smartWrapText } from "../utils/smart-text-wrapper";

// Process text before rendering
const processedText = preventOrphanLines(text);
```

### 2. **CSS Properties for Text Rendering**

**CRITICAL CSS Rules:**

```tsx
{
  whiteSpace: "pre-line",        // Respect line breaks but allow wrapping
  wordBreak: "keep-all",         // Keep words intact (no hyphenation)
  overflowWrap: "break-word",    // Break word on boundary if needed
  letterSpacing: "-0.01em",      // Tighten spacing to control wrapping
  lineHeight: 1.0 to 1.1,        // Control line height
  maxWidth: "appropriate-value", // Ensure content doesn't overflow
}
```

### 3. **DO NOT Use These Properties**

❌ `whiteSpace: "nowrap"` - Forces single line, causes overflow
❌ `hyphens: "auto"` - Breaks words with hyphens (Vietnamese incompatible)
❌ `whiteSpace: "normal"` - Allows aggressive wrapping
❌ `wordBreak: "break-word"` - Breaks words in middle (bad UX)

## Component Guidelines

### CinematicCallout

```tsx
// Import & process
const processedText = preventOrphanLines(text);

// CSS Style
style={{
  whiteSpace: "pre-line",
  wordBreak: "keep-all",
  overflowWrap: "break-word",
  maxWidth: 700,
  // ... other properties
}}

// Render
{processedText}
```

### BottomTitle

```tsx
const processedText = preventOrphanLines(titleText);

style={{
  whiteSpace: "pre-line",      // Changed from "nowrap"
  wordBreak: "keep-all",
  overflowWrap: "break-word",
  maxWidth: "92vw",
  // ... other properties
}}

{processedText}
```

### SidePanelOverlay

```tsx
const processedPanelText = preventOrphanLines(panelText);

style={{
  whiteSpace: "pre-line",       // Changed from "normal"
  wordBreak: "keep-all",        // Changed from "break-word"
  overflowWrap: "break-word",
  // ... other properties
}}

{processedPanelText}
```

### BRollOverlay

For word-by-word animations, use `smartWrapText()`:

```tsx
const wrappedLines = smartWrapText(text);
const displayWords: string[] = [];
wrappedLines.forEach((line) => {
  const lineWords = line.split(" ");
  lineWords.forEach((w) => {
    displayWords.push(w);
  });
});

// Use displayWords instead of words
{displayWords.map((w, i) => (
  // render word
))}
```

Add to flex container:
```tsx
style={{
  display: "flex",
  flexWrap: "wrap",
  wordBreak: "keep-all",  // CRITICAL
  // ... other properties
}}
```

## Utility Functions

### `preventOrphanLines(text: string): string`

Removes single-word last lines and ensures proper text flow.

**Example:**
```
Input:  "HELLO WORLD FOO"
Output: "HELLO\nWORLD FOO"  (prevents orphaned "FOO")
```

### `smartWrapText(text: string, maxLinesAfter?: number): string[]`

Intelligently breaks text into lines while keeping short words together.

**Example:**
```
Input:  "Join the community of"
Output: ["Join the", "community of"]  (keeps "of" with "community")
```

### `getAdaptiveFontSize(text: string, options?): number`

Calculates optimal font size based on text length.

### `textWrapCSSProps`

Pre-built CSS object for consistent text wrapping:

```tsx
<div style={{
  ...textWrapCSSProps,
  // ... override as needed
}}>
```

## Testing Checklist

When implementing text overlays:

- [ ] No single character on its own line
- [ ] No single short word (≤3 chars) on its own line
- [ ] Text doesn't overflow boundaries
- [ ] Vietnamese diacritics render correctly
- [ ] Text looks balanced visually
- [ ] Font size adapts to text length
- [ ] Line height is readable (1.0-1.2)

## Common Issues & Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Text overflows container | `maxWidth` too small or `whiteSpace: nowrap` | Use `pre-line` + `maxWidth` balance |
| Single char on line | Aggressive wrapping | Use `preventOrphanLines()` + `keep-all` |
| Words have hyphens | `hyphens: auto` enabled | Remove hyphens property |
| Weird word breaks | `wordBreak: break-word` | Use `keep-all` instead |
| Spacing looks off | `letterSpacing` + font size mismatch | Adjust `letterSpacing` to control wrap |

## Vietnamese Text Notes

- Never use `hyphens: auto` - breaks Vietnamese words
- Use `wordBreak: "keep-all"` to preserve word integrity
- Test with Vietnamese diacritics (á, ả, ã, ạ, etc.)
- Font must support Vietnamese Unicode (Inter does ✓)

## Future Enhancements

Planned improvements:
1. **Auto Font Size Optimization** - Calculate ideal size based on container
2. **Semantic Line Breaking** - Break at clause boundaries for Vietnamese
3. **Hyphenation Dictionary** - Custom rules for common words
4. **Visual Testing Suite** - Automated screenshot comparison tests
