/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from "node:test";
import { main } from "../main/run.ts";
import { captureOutput } from "./utils.ts";
import assert from "node:assert";

describe("run", () => {
    it("shows help on --help option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--help" ]);
        output.restore();
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^Usage: run /);
    });
    it("shows errors and mentions help when no arguments was given", async (t) => {
        const output = captureOutput(t);
        const result = await main([]);
        output.restore();
        assert.equal(result, 2);
        assert.equal(output.stderr, "run: missing script name\nTry 'cmd --help' for more information.\n");
        assert.equal(output.stdout, "");
    });
});
