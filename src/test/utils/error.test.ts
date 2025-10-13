/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { getErrorMessage, toError } from "../../main/utils/error.ts";

describe("error", () => {
    describe("getErrorMessage", () => {
        it("returns message from Error object", () => {
            assert.equal(getErrorMessage(new Error("Message")), "Message");
        });
        it("returns error converted to string if not Error object", () => {
            assert.equal(getErrorMessage("Message"), "Message");
            assert.equal(getErrorMessage(123), "123");
            assert.equal(getErrorMessage(false), "false");
        });
    });

    describe("toError", () => {
        it("returns error when already Error instance", () => {
            const error = new Error("test");
            assert.strictEqual(toError(error), error);
        });
        it("converts to error when not Error instance", () => {
            assert.deepEqual(toError("Message"), new Error("Message"));
        });
    });
});
