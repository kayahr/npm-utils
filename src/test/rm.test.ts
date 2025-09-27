/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { main } from "../main/rm.ts";
import { captureOutput } from "./utils.ts";

const tmpPrefix = join(tmpdir(), "@kayahr-npm-utils-");
const testFiles = [
    "test1.txt",
    "test2.txt",
    "test1.png",
    "deep/test3.txt",
    "deep/deeper/test4.txt"
];

describe("rm", () => {
    let tmpDir: string;

    beforeEach(async () => {
        // Create temporary working directory
        tmpDir = await mkdtemp(tmpPrefix);

        // Create some test files
        for (const testFile of testFiles) {
            const path = join(tmpDir, testFile);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, `Content of ${testFile}`);
        }
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true });
    });

    async function list(): Promise<string[]> {
        return (await readdir(tmpDir, { recursive: true })).sort();
    }

    it("shows help on --help option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--help" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^Usage: rm /);
    });

    it("removes a single file", async () => {
        const result = await main([
            join(tmpDir, "deep/test3.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "deep", join("deep/deeper"), join("deep/deeper/test4.txt"), "test1.png", "test1.txt", "test2.txt" ]);
    });

    it("removes multiple files", async () => {
        const result = await main([
            join(tmpDir, "deep/deeper/test4.txt"),
            join(tmpDir, "*.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "deep", join("deep/deeper"), join("deep/test3.txt"), "test1.png" ]);
    });

    it("removes a single file with absolute filename", async () => {
        const result = await main([
            join(tmpDir, "deep/test3.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "deep", join("deep/deeper"), join("deep/deeper/test4.txt"), "test1.png", "test1.txt", "test2.txt" ]);
    });

    it("removes a single file with filename relative to working directory", async () => {
        const result = await main([
            "--cwd", tmpDir,
            join("deep/test3.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "deep", join("deep/deeper"), join("deep/deeper/test4.txt"), "test1.png", "test1.txt", "test2.txt" ]);
    });

    it("removes a single directory recursively", async () => {
        const result = await main([
            "-r",
            join(tmpDir, "deep")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "test1.png", "test1.txt", "test2.txt" ]);
    });
});
