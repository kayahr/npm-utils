/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { main } from "../main/rm.ts";
import { captureOutput } from "./support/utils.ts";
import { execFileSync } from "node:child_process";

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
        return (await readdir(tmpDir, { recursive: true })).toSorted();
    }

    it("can be executed as Node.js script", async () => {
        const output = execFileSync(process.execPath, [ "src/main/rm.ts", "--help" ], { encoding: "utf8" });
        assert.match(output, /^Usage: rm /);
    });

    it("shows help on --help option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--help" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^Usage: rm /);
    });

    it("shows version on --version option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--version" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^rm \d+\.\d+\.\d+\n\nWritten by Klaus Reimer <k@ailis.de>\n$/);
    });

    it("shows error and mentions help when no arguments was given", async (t) => {
        const output = captureOutput(t);
        const result = await main([]);
        assert.equal(result, 2);
        assert.equal(output.stderr, "rm: missing pattern\nTry 'rm --help' for more information.\n");
        assert.equal(output.stdout, "");
    });

    it("does not remove files in dry run", async (t) => {
        const output = captureOutput(t);
        const result = await main([
            "--dry-run",
            join(tmpDir, "deep/deeper/test4.txt"),
            join(tmpDir, "*.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [
            "deep",
            join("deep/deeper"),
            join("deep/deeper/test4.txt"),
            join("deep/test3.txt"),
            "test1.png",
            "test1.txt",
            "test2.txt"
        ]);
        assert.equal(output.stdout,
            `Would remove '${join(tmpDir, "deep/deeper/test4.txt")}'\n`
            + `Would remove '${join(tmpDir, "test1.txt")}'\n`
            + `Would remove '${join(tmpDir, "test2.txt")}'\n`
        );
    });

    it("does report deleted files in verbose mode", async (t) => {
        const output = captureOutput(t);
        const result = await main([
            "--limit=1",
            "--verbose",
            join(tmpDir, "deep/deeper/test4.txt"),
            join(tmpDir, "*.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [ "deep", join("deep/deeper"), join("deep/test3.txt"), "test1.png" ]);
        assert.equal(output.stdout,
            `Removed '${join(tmpDir, "deep/deeper/test4.txt")}'\n`
            + `Removed '${join(tmpDir, "test1.txt")}'\n`
            + `Removed '${join(tmpDir, "test2.txt")}'\n`
        );
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

    it("does nothing when removing non-existent file and force mode is enabled", async () => {
        const result = await main([
            "-f",
            join(tmpDir, "not-existent.txt")
        ]);
        assert.equal(result, 0);
        assert.deepEqual(await list(), [
            "deep",
            join("deep/deeper"),
            join("deep/deeper/test4.txt"),
            join("deep/test3.txt"),
            "test1.png",
            "test1.txt",
            "test2.txt"
        ]);
    });

    it("throws error when removing non-existent file and force mode is disabled", async (t) => {
        const output = captureOutput(t);
        const result = await main([
            join(tmpDir, "not-existent.txt")
        ]);
        assert.equal(result, 1);
        assert.equal(output.stderr, `rm: cannot remove '${join(tmpDir, "not-existent.txt")}': No such file or directory\n`);
    });

    it("throws error when trying to remove write-protected file", async (t) => {
        const output = captureOutput(t);
        const testFile = join(tmpDir, "test1.txt");
        await chmod(testFile, 0o444); // For windows
        await chmod(tmpDir, 0o555); // For linux
        try {
            const result = await main([ testFile ]);
            assert.equal(result, 1);
            assert.equal(output.stderr, `rm: EACCES: permission denied, unlink '${testFile}'\n`);
        } finally {
            await chmod(tmpDir, 0o777); // For linux
            await chmod(testFile, 0o666); // For windows
        }
    });

    it("throws aggregated error when trying to remove multiple write-protected files", async (t) => {
        const output = captureOutput(t);
        const testFile1 = join(tmpDir, "test1.txt");
        const testFile2 = join(tmpDir, "test2.txt");
        await chmod(testFile1, 0o444); // For windows
        await chmod(testFile2, 0o444); // For windows
        await chmod(tmpDir, 0o555); // For linux
        try {
            const result = await main([ testFile1, testFile2 ]);
            assert.equal(result, 1);
            assert.equal(output.stderr, `rm: failed to remove 2 files\n`
                + `  EACCES: permission denied, unlink '${testFile1}'\n`
                + `  EACCES: permission denied, unlink '${testFile2}'\n`
            );
        } finally {
            await chmod(tmpDir, 0o777); // For linux
            await chmod(testFile1, 0o666); // For windows
            await chmod(testFile2, 0o666); // For windows
        }
    });

    it("can delete lots of files", async () => {
        for (let i = 1; i < 1000; i++) {
            await writeFile(join(tmpDir, `test-file-${i}.txt`), `Content ${i}`);
        }
        const result = await main([ "--limit=4", join(tmpDir, "*.txt") ]);
        assert.equal(result, 0);
    });

    it("can pass max-retries and retry-delay options", async () => {
        const result = await main([ "--max-retries=1", "--retry-delay=10", join(tmpDir, "test1.txt") ]);
        assert.equal(result, 0);
    });
});
