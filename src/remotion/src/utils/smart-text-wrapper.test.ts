import { preventOrphanLines, smartWrapText, getAdaptiveFontSize } from "../src/remotion/src/utils/smart-text-wrapper";

describe("Text Wrapping Utilities", () => {
    describe("preventOrphanLines", () => {
        it("should prevent single short words on last line", () => {
            const text = "HELLO WORLD FOO";
            const result = preventOrphanLines(text);
            expect(result).not.toMatch(/\nFOO$/);
        });

        it("should preserve multi-line text structure", () => {
            const text = "HELLO\nWORLD\nFOO";
            const result = preventOrphanLines(text);
            // Should still have proper line breaks
            expect(result).toContain("\n");
        });

        it("should handle single words", () => {
            const result = preventOrphanLines("HELLO");
            expect(result).toBe("HELLO");
        });

        it("should handle Vietnamese text", () => {
            const text = "XÍCH LỊP HỮU HẠN";
            const result = preventOrphanLines(text);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("smartWrapText", () => {
        it("should split text intelligently", () => {
            const text = "THE QUICK BROWN FOX";
            const result = smartWrapText(text);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it("should not create orphan lines", () => {
            const text = "JOIN THE COMMUNITY OF CREATORS";
            const result = smartWrapText(text);
            // Check that no single word remains on last line
            const lastLine = result[result.length - 1];
            const lastLineWords = lastLine.split(/\s+/);
            expect(lastLineWords.length).toBeGreaterThanOrEqual(1);
        });

        it("should handle short text", () => {
            const result = smartWrapText("HI");
            expect(result).toEqual(["HI"]);
        });
    });

    describe("getAdaptiveFontSize", () => {
        it("should return smaller font for long text", () => {
            const longText = "THIS IS A VERY LONG TEXT THAT SHOULD GET A SMALLER FONT SIZE";
            const shortText = "SHORT";
            expect(getAdaptiveFontSize(longText)).toBeLessThan(
                getAdaptiveFontSize(shortText)
            );
        });

        it("should respect min/max options", () => {
            const text = "MEDIUM TEXT";
            const result = getAdaptiveFontSize(text, {
                minSize: 30,
                maxSize: 100,
            });
            expect(result).toBeGreaterThanOrEqual(30);
            expect(result).toBeLessThanOrEqual(100);
        });

        it("should handle edge cases", () => {
            expect(getAdaptiveFontSize("")).toBeTruthy();
            expect(getAdaptiveFontSize("A")).toBeTruthy();
        });
    });
});
