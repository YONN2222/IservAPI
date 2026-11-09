import { describe, expect, test } from "vitest";
import { parseAutocompleteExtra, UserService } from "../src/User/UserService.js";
import { createMockIServSession, type MockRoute } from "./helpers/mockIServSession.js";

const URL = "https://iserv.example/iserv/core/autocomplete/api";

function entry(name: string, email: string, extra: string, source = "user") {
  return {
    label: `${name} <${email}>`,
    text: `${name} <${email}>`,
    value: `user:${name} <${email}>`,
    source,
    avatar: null,
    avatarHtml: "",
    extra,
    certainty: 9,
    fuzzy: false,
  };
}

function route(query: string, limit: number, results: unknown[]): MockRoute {
  return {
    method: "get",
    url: URL,
    params: { type: "list,mail", query, limit },
    response: { data: JSON.stringify(results) },
  };
}

describe("parseAutocompleteExtra", () => {
  test("splits a short code from the roles", () => {
    expect(parseAutocompleteExtra("HMS, Lehrer")).toEqual({ shortCode: "HMS", roles: ["Lehrer"] });
  });

  test("handles entries without a short code", () => {
    expect(parseAutocompleteExtra("Lehrer")).toEqual({ shortCode: null, roles: ["Lehrer"] });
    expect(parseAutocompleteExtra("")).toEqual({ shortCode: null, roles: [] });
  });

  test("drops the fuzzy-match marker and does not mistake roles for short codes", () => {
    expect(parseAutocompleteExtra("Schüler, Ähnlicher Name")).toEqual({
      shortCode: null,
      roles: ["Schüler"],
    });
  });
});

describe("UserService.searchDirectory", () => {
  test("maps autocomplete hits to name, email, short code and roles and skips non-user sources", async () => {
    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        route("herme", 50, [
          entry("Björn Hermes", "bjoern.hermes@iserv.example", "HMS, Lehrer"),
          entry("Mailing List", "list@iserv.example", "", "group"),
        ]),
      ],
    });

    const result = await new UserService(session).searchDirectory("herme");

    expect(result).toEqual([
      {
        name: "Björn Hermes",
        email: "bjoern.hermes@iserv.example",
        shortCode: "HMS",
        roles: ["Lehrer"],
      },
    ]);
    expectAllRoutesCalled();
  });
});
