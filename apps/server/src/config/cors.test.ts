import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./cors.js";

describe("CORS origin", () => {
  it("프로덕션과 Vercel 미리보기 주소를 허용한다", () => {
    expect(isAllowedOrigin("https://brain-arena-xi.vercel.app")).toBe(true);
    expect(isAllowedOrigin("https://brain-arena-git-main-example.vercel.app")).toBe(true);
  });
  it("관계없는 외부 주소를 거부한다", () => {
    expect(isAllowedOrigin("https://attacker.example.com")).toBe(false);
  });
});
