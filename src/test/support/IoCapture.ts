/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { PassThrough } from "node:stream";

/**
 * Provides a captured {@link stdout} and {@link stderr} stream which can be passed to the main function to capture output.
 */
export class IoCapture {
    /** The capturing stdout stream. */
    readonly stdout = new PassThrough();

    /** The capturing stderr stream. */
    readonly stderr = new PassThrough();

    /** The captured stdout text. */
    public capturedStdout = "";

    /** The captured stderr text. */
    public capturedStderr = "";

    public constructor() {
        this.stdout.setEncoding("utf8").on("data", data => (this.capturedStdout += data));
        this.stderr.setEncoding("utf8").on("data", data => (this.capturedStderr += data));
    }
}
