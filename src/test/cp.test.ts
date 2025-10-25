/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { main } from "../main/cp.ts";
import { captureOutput, exists } from "./support/utils.ts";
import { execFileSync } from "node:child_process";

const tmpPrefix = join(tmpdir(), "@kayahr-npm-utils-");
const testFiles = [
    "source/test1.txt",
    "source/test2.txt",
    "source/test1.png",
    "source/test2.png",
    "source/deep/test3.txt",
    "source/deep/test3.png",
    "source/deep/deeper/test4.txt",
    "source/deep/deeper/test4.png"
];

describe("cp", () => {
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

    async function list(dir: string): Promise<string[]> {
        return (await readdir(dir, { recursive: true })).toSorted();
    }

    it("can be executed as Node.js script", async () => {
        const output = execFileSync(process.execPath, [ "src/main/cp.ts", "--help" ], { encoding: "utf8" });
        assert.match(output, /^Usage: cp /);
    });

    it("shows help on --help option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--help" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^Usage: cp /);
    });

    it("shows version on --version option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--version" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^cp \d+\.\d+\.\d+\n\nWritten by Klaus Reimer <k@ailis.de>\n$/);
    });

    it("shows error and mentions help when no arguments was given", async (t) => {
        const output = captureOutput(t);
        const result = await main([]);
        assert.equal(result, 2);
        assert.equal(output.stderr, "cp: missing destination file operand\nTry 'cp --help' for more information.\n");
        assert.equal(output.stdout, "");
    });

    it("shows error and mentions help when only one argument was given", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "test" ]);
        assert.equal(result, 2);
        assert.equal(output.stderr, "cp: missing source file operand\nTry 'cp --help' for more information.\n");
        assert.equal(output.stdout, "");
    });

    it("does not copy files in dry run", async (t) => {
        const output = captureOutput(t);
        const dest = join(tmpDir, "dest");
        const sources = [
            join(tmpDir, "source/test1.txt"),
            join(tmpDir, "source/*.png")
        ];
        const result = await main([
            "--dry-run",
            ...sources,
            dest
        ]);
        assert.equal(result, 0);
        assert.equal(await exists(dest), false);
        assert.equal(output.stdout,
            `Would copy '${sources[0]}' to '${join(dest, "test1.txt")}'\n`
            + `Would copy '${sources[1].replace("*", "test1")}' to '${join(dest, "test1.png")}'\n`
            + `Would copy '${sources[1].replace("*", "test2")}' to '${join(dest, "test2.png")}'\n`
        );
    });

    it("does report copied sources in verbose mode", async (t) => {
        const output = captureOutput(t);
        const dest = join(tmpDir, "dest");
        const sources = [
            join(tmpDir, "source/test1.txt"),
            join(tmpDir, "source/test1.png")
        ];
        const result = await main([
            "--verbose",
            ...sources,
            dest
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout,
            `Copied '${sources[0]}' to '${join(dest, "test1.txt")}'\n`
            + `Copied '${sources[1]}' to '${join(dest, "test1.png")}'\n`
        );
        assert.deepEqual(await list(dest), [
            "test1.png",
            "test1.txt"
        ]);
    });

    it("copies files with include/exclude filters", async (t) => {
        const output = captureOutput(t);
        const dest = join(tmpDir, "dest");
        const sources = [
            join(tmpDir, "source"),
        ];
        const result = await main([
            "--recursive",
            "--verbose",
            "--include", "**/*.txt",
            "--exclude", "deep/test3.txt",
            ...sources,
            dest
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout, "Filtering 'deep'\n"
            + "Filtering 'deep/deeper'\n"
            + "Filtering 'deep/deeper/test4.png'\n"
            + "Filtering 'deep/deeper/test4.txt'\n"
            + "Including 'deep/deeper/test4.txt'\n"
            + "Filtering 'deep/test3.png'\n"
            + "Filtering 'deep/test3.txt'\n"
            + "Excluding 'deep/test3.txt'\n"
            + "Filtering 'test2.png'\n"
            + "Filtering 'test1.png'\n"
            + "Filtering 'test2.txt'\n"
            + "Including 'test2.txt'\n"
            + "Filtering 'test1.txt'\n"
            + "Including 'test1.txt'\n"
            + `Copied '${join(tmpDir, "source")}' to '${join(tmpDir, "dest")}'\n`);
        assert.deepEqual(await list(dest), [
            "deep",
            "deep/deeper",
            "deep/deeper/test4.txt",
            "test1.txt",
            "test2.txt"
        ]);
    });

    it("can copy a single file", async (t) => {
        const output = captureOutput(t);
        const result = await main([
            join(tmpDir, "source/test1.txt"),
            join(tmpDir, "dest/test1.txt"),
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout, "");
        assert.deepEqual(await list(join(tmpDir, "dest")), [
            "test1.txt"
        ]);
    });

    it("can copy files matched by glob", async (t) => {
        const output = captureOutput(t);
        const dest = join(tmpDir, "dest");
        const result = await main([
            join(tmpDir, "**/*.txt"),
            dest
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout, "");
        assert.deepEqual(await list(dest), [
            "test1.txt",
            "test2.txt",
            "test3.txt",
            "test4.txt",
        ]);
    });

    it("can copy files matched by glob and keeping parent directories", async (t) => {
        const output = captureOutput(t);
        const dest = join(tmpDir, "dest");
        const result = await main([
            "--parents",
            "--cwd", join(tmpDir, "source"),
            "**/*.txt",
            dest
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout, "");
        assert.deepEqual(await list(dest), [
            "deep",
            "deep/deeper",
            "deep/deeper/test4.txt",
            "deep/test3.txt",
            "test1.txt",
            "test2.txt"
        ]);
    });

    it("can copy files recursively while excluding some files and verbosely reporting", async (t) => {
        const output = captureOutput(t);
        const source = join(tmpDir, "source");
        const dest = join(tmpDir, "dest");
        const result = await main([
            "-r",
            "--verbose",
            "--exclude", "deep/**/*.txt",
            source,
            dest
        ]);
        assert.equal(output.stderr, "");
        assert.equal(result, 0);
        assert.equal(output.stdout, "Filtering 'deep'\n"
            + "Filtering 'deep/deeper'\n"
            + "Filtering 'deep/deeper/test4.png'\n"
            + "Filtering 'deep/deeper/test4.txt'\n"
            + "Excluding 'deep/deeper/test4.txt'\n"
            + "Filtering 'deep/test3.png'\n"
            + "Filtering 'deep/test3.txt'\n"
            + "Excluding 'deep/test3.txt'\n"
            + "Filtering 'test2.png'\n"
            + "Filtering 'test1.png'\n"
            + "Filtering 'test2.txt'\n"
            + "Filtering 'test1.txt'\n"
            + `Copied '${source}' to '${dest}'\n`
        );
        assert.deepEqual(await list(dest), [
            "deep",
            "deep/deeper",
            "deep/deeper/test4.png",
            "deep/test3.png",
            "test1.png",
            "test1.txt",
            "test2.png",
            "test2.txt",
        ]);
    });

    it("throws error when trying to copy non-existent file", async (t) => {
        const output = captureOutput(t);
        const result = await main([
            join(tmpDir, "not-existent.txt"),
            join(tmpDir, "dest")
        ]);
        assert.equal(result, 1);
        assert.equal(output.stderr, `cp: source path '${join(tmpDir, "not-existent.txt")}' did not match any file or directory\n`);
    });
});
