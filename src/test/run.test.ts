/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import { main } from "../main/run.ts";
import { captureOutput, isWindows } from "./support/utils.ts";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IoCapture } from "./support/IoCapture.ts";

const tmpPrefix = join(tmpdir(), "@kayahr-npm-utils-");

async function withWorkingDir<T>(dir: string, callback: () => Promise<T>): Promise<T> {
    const oldCwd = process.cwd();
    process.chdir(dir);
    try {
        return await callback();
    } finally {
        process.chdir(oldCwd);
    }
};

describe("run", () => {
    let oldNpmExecPath: string | undefined;
    let tmpDir: string;

    beforeEach(async () => {
        // Create temporary working directory
        tmpDir = await mkdtemp(tmpPrefix);

        // Create package.json with some scripts
        await writeFile(join(tmpDir, "package.json"), JSON.stringify({
            "scripts": {
                "clean": "clean-script",
                "build": "run build:*",
                "build:compile": "compile-script",
                "build:schema": "run build:schema:",
                "build:schema:a": "schema-script-a",
                "build:schema:b": "schema-script-b",
                "test": "run test:*",
                "test:unit": "test-script-unit",
                "test:lint": "test-script-lint",
                "test:spell": "test-script-spell",
                "error": "run error:*",
                "error:a": "error-script-a",
                "error:b": "error-script-b"
            }
        }));

        // Create NPM dummy
        await writeFile(join(tmpDir, "npm.mjs"), `
            process.stdout.write("\\n" + JSON.stringify(process.argv));
            if (process.argv.some(s => s.includes("error"))) {
                process.exit(1);
            }
        `);

        // Set npm-exec-path to test script
        oldNpmExecPath = process.env.npm_execpath;
        process.env.npm_execpath = join(tmpDir, "npm.mjs");
    });

    afterEach(async () => {
        process.env.npm_execpath = oldNpmExecPath;
        await rm(tmpDir, { recursive: true });
    });

    it("can be executed as Node.js script", async () => {
        const output = execFileSync(process.execPath, [ "src/main/run.ts", "--help" ], { encoding: "utf8" });
        assert.match(output, /^Usage: run /);
    });

    it("shows help on --help option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--help" ]);
        output.restore();
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^Usage: run /);
    });

    it("shows version on --version option", async (t) => {
        const output = captureOutput(t);
        const result = await main([ "--version" ]);
        assert.equal(result, 0);
        assert.equal(output.stderr, "");
        assert.match(output.stdout, /^run \d+\.\d+\.\d+\n\nWritten by Klaus Reimer <k@ailis.de>\n$/);
    });

    it("shows error and mentions help when no arguments was given", async (t) => {
        const output = captureOutput(t);
        const result = await main([]);
        output.restore();
        assert.equal(result, 2);
        assert.equal(output.stderr, "run: missing script name\nTry 'cmd --help' for more information.\n");
        assert.equal(output.stdout, "");
    });

    it("throws error when no package.json found", async (t) => {
        await rm(join(tmpDir, "package.json"));
        const output = captureOutput(t);
        const result = await withWorkingDir(tmpDir, () => main([ "build"]));
        output.restore();
        assert.equal(result, 1);
        assert.equal(output.stderr, "run: Unable to locate package.json\n");
        assert.equal(output.stdout, "");
    });

    it("passes silent option to NPM if specified", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "--silent", "build:schema:a" ], io));
        assert.equal(result, 0);
        const output = JSON.parse(io.capturedStdout) as string[];
        assert.equal(output.length, 5);
        assert.equal(output[2], "run");
        assert.equal(output[3], "-s");
        assert.equal(output[4], "build:schema:a");
    });

    it("can run a single script", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "build:schema:a" ], io));
        assert.equal(result, 0);
        const output = JSON.parse(io.capturedStdout) as string[];
        assert.equal(output.length, 4);
        assert.equal(output[2], "run");
        assert.equal(output[3], "build:schema:a");
    });

    it("can run a single scripts with '*' wildcard", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "build:*" ], io));
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 2);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "build:compile");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[1][3], "build:schema");
    });

    it("can run a single scripts with '**' wildcard", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "build:**" ], io));
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 4);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "build:compile");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[1][3], "build:schema");
        assert.equal(outputs[2][2], "run");
        assert.equal(outputs[2][3], "build:schema:a");
        assert.equal(outputs[3][2], "run");
        assert.equal(outputs[3][3], "build:schema:b");
    });

    it("can run multiple scripts", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "build:schema:a", "build:schema:b" ], io));
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 2);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "build:schema:a");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[1][3], "build:schema:b");
    });

    it("can run multiple scripts in parallel", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "--parallel", "test:*" ], io));
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 3);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[2][2], "run");
        const scripts = outputs.flatMap(a => a[3]).toSorted();
        assert.deepEqual(scripts, [ "test:lint", "test:spell", "test:unit" ]);
    });

    it("reports multiple errors in parallel mode", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "--parallel", "error:*" ], io));
        assert.equal(result, 1);
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 2);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "error:a");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[1][3], "error:b");
        assert.match(io.capturedStderr, /^run: Execution of 2 commands failed\n/);
        assert.match(io.capturedStderr, /error:a exited with code 1\n/);
        assert.match(io.capturedStderr, /error:b exited with code 1\n/);
    });

    it("reports single error in parallel mode", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "--parallel", "build:compile", "error:a" ], io));
        assert.equal(result, 1);
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 2);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "build:compile");
        assert.equal(outputs[1][2], "run");
        assert.equal(outputs[1][3], "error:a");
        assert.equal(io.capturedStderr, "run: error:a exited with code 1\n");
    });

    it("reports first errors in sequential mode", async () => {
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "error:*" ], io));
        assert.equal(result, 1);
        const outputs = io.capturedStdout.trim().split("\n").map(line => JSON.parse(line) as string[]);
        assert.equal(outputs.length, 1);
        assert.equal(outputs[0][2], "run");
        assert.equal(outputs[0][3], "error:a");
        assert.equal(io.capturedStderr, "run: error:a exited with code 1\n");
    });

    it("throws error if npm_execpath env variable is missing", async () => {
        delete process.env.npm_execpath;
        const io = new IoCapture();
        const result = await withWorkingDir(tmpDir, () => main([ "error:*" ], io));
        assert.equal(result, 1);
        assert.equal(io.capturedStdout, "");
        assert.equal(io.capturedStderr, "run: Environment variable 'npm_execpath' not found. Make sure to run this script through NPM\n");
    });

    it("can output to real console", { skip: isWindows() }, async () => {
        const outFile = join(tmpDir, "out.txt");
        await writeFile(join(tmpDir, "npm.mjs"), `
            import { writeFile } from "node:fs/promises";
            await writeFile("${outFile}", JSON.stringify(process.argv));
        `);
        const result = await withWorkingDir(tmpDir, () => main([ "build:compile" ]));
        assert.equal(result, 0);
        const output = JSON.parse(await readFile(outFile, "utf8")) as string[];
        assert.equal(output[2], "run");
        assert.equal(output[3], "build:compile");
    });
});
