/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { assertEquals, } from "@kayahr/assert";
import { describe, it } from "node:test";
import { getColorLevel } from "../main/colors.ts";

// Define getColorDepth methods if not present or otherwise it can't be mocked
process.stdout.getColorDepth ??= () => 1;
process.stderr.getColorDepth ??= () => 1;

describe("colors", () => {
    describe("getColorLevel", () => {
        it("returns 0 when process.stdout.getColorDepth is not present", t => {
            t.mock.property(process.stdout, "getColorDepth", undefined);
            assertEquals(getColorLevel(), 0);
        });
        it("returns 0 when process.stderr.getColorDepth is not present", t => {
            t.mock.property(process.stderr, "getColorDepth", undefined);
            assertEquals(getColorLevel(), 0);
        });
        it("returns 1 when getColorDepth returns 4", t => {
            t.mock.property(process.stdout, "getColorDepth", () => 4);
            t.mock.property(process.stderr, "getColorDepth", () => 4);
            assertEquals(getColorLevel(), 1);
        });
        it("returns 2 when getColorDepth returns 8", t => {
            t.mock.property(process.stdout, "getColorDepth", () => 8);
            t.mock.property(process.stderr, "getColorDepth", () => 8);
            assertEquals(getColorLevel(), 2);
        });
        it("returns 3 when getColorDepth returns 24", t => {
            t.mock.property(process.stdout, "getColorDepth", () => 24);
            t.mock.property(process.stderr, "getColorDepth", () => 24);
            assertEquals(getColorLevel(), 3);
        });
        it("uses stdout color depth if lower than stderr color depth", t => {
            t.mock.property(process.stdout, "getColorDepth", () => 8);
            t.mock.property(process.stderr, "getColorDepth", () => 24);
            assertEquals(getColorLevel(), 2);
        });
        it("uses stderr color depth if lower than stdout color depth", t => {
            t.mock.property(process.stdout, "getColorDepth", () => 24);
            t.mock.property(process.stderr, "getColorDepth", () => 8);
            assertEquals(getColorLevel(), 2);
        });
    });
});
