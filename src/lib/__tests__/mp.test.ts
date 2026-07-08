import { inviteLink } from "@/lib/mp";

describe("mp.inviteLink", () => {
  it("builds the activation path for a token", () => {
    expect(inviteLink("abc123")).toBe("/mp-activate?token=abc123");
  });

  it("URL-encodes the token", () => {
    expect(inviteLink("a b/c")).toBe("/mp-activate?token=a%20b%2Fc");
  });
});
