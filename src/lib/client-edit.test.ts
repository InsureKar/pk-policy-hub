import { describe, expect, it } from "vitest";
import { changedClientFields } from "./client-edit";

describe("client information updates", () => {
  it("updates only changed information, leaving other client data untouched", () => {
    expect(changedClientFields({ company_name: "Client", phone: "03001234567", city: "Karachi" }, { company_name: "Client", phone: "03007654321", city: "Karachi" })).toEqual({ phone: "03007654321" });
  });
  it("does not write anything when the information is unchanged", () => {
    expect(changedClientFields({ phone: "03001234567" }, { phone: "03001234567" })).toEqual({});
  });
});