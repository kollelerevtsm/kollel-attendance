import { describe, it, expect } from "vitest";
import { amountInWords, micrFields, validRouting } from "./checks";

describe("checks", () => {
  it("writes amounts in words", () => {
    expect(amountInWords(120)).toBe("One Hundred Twenty and 00/100");
    expect(amountInWords(1234.5)).toBe("One Thousand Two Hundred Thirty-Four and 50/100");
    expect(amountInWords(15)).toBe("Fifteen and 00/100");
    expect(amountInWords(0.07)).toBe("Zero and 07/100");
  });
  it("checks routing numbers", () => {
    expect(validRouting("021000021")).toBe(true);
    expect(validRouting("021000022")).toBe(false);
    expect(validRouting("12345")).toBe(false);
  });
  it("builds the MICR fields", () => {
    expect(micrFields(1001, "021000021", "123456789")).toEqual({ auxOnUs: "C001001C", transit: "A021000021A", onUs: "123456789C" });
  });
});
