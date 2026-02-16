import { describe, it, expect } from "vitest";

import { countCharacters, countWords } from "./textStats";

describe("countCharacters", () => {
  it("counts characters including spaces", () => {
    expect(countCharacters("hello world")).toBe(11);
  });

  it("returns 0 for empty string", () => {
    expect(countCharacters("")).toBe(0);
  });

  it("counts whitespace-only strings", () => {
    expect(countCharacters("   ")).toBe(3);
  });

  it("counts special characters", () => {
    expect(countCharacters("hello! @world#")).toBe(14);
  });

  it("counts newlines and tabs", () => {
    expect(countCharacters("hello\nworld\tthere")).toBe(17);
  });
});

describe("countWords", () => {
  it("counts words separated by spaces", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  it("handles newlines and tabs", () => {
    expect(countWords("hello\nworld\there")).toBe(3);
  });

  it("handles leading/trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });

  it("handles mixed whitespace", () => {
    expect(countWords("hello \n \t world  \n  test")).toBe(3);
  });
});
