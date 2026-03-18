/**
 * Smart Text Wrapping Utility
 *
 * Prevents orphaned text (single characters/words on new line)
 * and handles Vietnamese text intelligently.
 */

/**
 * Split text intelligently to prevent widow/orphan text
 * - Keeps short words together with previous words
 * - Ensures no single character breakpoints
 * - Returns text with optimal break points
 */
export const smartWrapText = (text: string): string[] => {
    if (!text || text.trim().length === 0) return [];

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [text];

    const lines: string[] = [];
    let currentLine: string[] = [];

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const nextWord = i + 1 < words.length ? words[i + 1] : null;
        const isLastWord = i === words.length - 1;

        currentLine.push(word);

        // Prevent orphaned last word
        if (
            isLastWord &&
            currentLine.length > 1 &&
            word.length <= 3 &&
            lines.length > 0
        ) {
            // Move short last word to previous line
            lines[lines.length - 1] += " " + currentLine.join(" ");
            currentLine = [];
        } else if (
            nextWord &&
            nextWord.length <= 3 &&
            i !== words.length - 2 // Don't apply if nextWord is the last word
        ) {
            // Look ahead: if next word is short, include it with current
            currentLine.push(nextWord);
            i++; // Skip the next word in loop
        }

        if (
            currentLine.length >= 2 ||
            (currentLine.length === 1 && word.length > 8) ||
            isLastWord
        ) {
            if (currentLine.length > 0) {
                lines.push(currentLine.join(" "));
                currentLine = [];
            }
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
    }

    return lines;
};

/**
 * Ensure no single word on last line
 * If the last line has only one word, move it to previous line
 */
export const preventOrphanLines = (text: string): string => {
    const lines = text.split("\n");
    if (lines.length <= 1) return text;

    const lastLine = lines[lines.length - 1].trim();
    const lastLineWords = lastLine.split(/\s+/);

    // If last line has only one word and it's short, merge with previous
    if (lastLineWords.length === 1 && lastLineWords[0].length <= 4 && lines.length > 1) {
        const prevLine = lines[lines.length - 2];
        lines[lines.length - 2] = prevLine + " " + lastLine;
        lines.pop();
    }

    return lines.join("\n");
};

/**
 * Get optimal font size based on text length
 * Prevents text overflow and wrapping issues
 */
export const getAdaptiveFontSize = (
    text: string,
    options: {
        minSize?: number;
        maxSize?: number;
        baseSize?: number;
    } = {}
): number => {
    const { minSize = 42, maxSize = 80, baseSize = 72 } = options;
    const cleanText = text.replace(/\s+/g, "");
    const length = cleanText.length;

    if (length > 30) return minSize;
    if (length > 22) return baseSize - 8;
    if (length > 15) return baseSize - 4;

    return Math.min(baseSize, maxSize);
};

/**
 * CSS properties to prevent orphaned text
 * Use in combination with word-break and overflow-wrap
 */
export const textWrapCSSProps = {
    wordBreak: "break-word" as const,
    overflowWrap: "break-word" as const,
    hyphens: "auto" as const,
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none" as const,
} as const;
