#!/usr/bin/env node
/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { parseArgs } from "node:util";

import packageJSON from "../../package.json" with { type: "json" };
import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { getColorLevel } from "./colors.ts";
import { access, constants, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Options for {@link run}.
 */
interface RunOptions {
    /** Run commands in parallel instead of sequentially. */
    parallel?: boolean;

    /** Set to true to pass --silent option to NPM. */
    silent?: boolean;
}

/**
 * Converts the given unresolved script name into a regular expression which can be used to match actual script names.
 *
 * @param command - The unresolved script name.
 * @returns The regular expression used to match actual script names.
 */
function commandToRegExp(command: string): RegExp {
    return new RegExp("^" + command.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*+/g, (a) => a.length === 1 ? "[^:]+" : ".*")  + "$");
}

/**
 * @returns The nearest package.json file in current or parent directories.
 *
 * @returns The
 */
async function findNearestPackageJson(dir = process.cwd()): Promise<string> {
    const candidate = join(dir, "package.json");
    try {
        await access(candidate, constants.F_OK);
        return candidate;
    } catch {
        const parent = dirname(dir);
        if (parent === dir) {
            throw new Error("Unable to locale package.json");
        }
        return findNearestPackageJson(parent);
    }
}

/**
 * Resolve wildcard in script names and returns the resolve script names.
 *
 * @param commands - The script names containing wildcards.
 * @returns The resolved script names.
 */
async function resolveCommands(commands: string[]): Promise<string[]> {
    const packageJSONFile = await findNearestPackageJson();
    const packageJSON = JSON.parse(await readFile(packageJSONFile, "utf-8")) as { scripts: Record<string, string> };
    const existingCommands = Object.keys(packageJSON.scripts);
    return commands.flatMap(command => {
        if (command.includes("*")) {
            const regexp = commandToRegExp(command);
            return existingCommands.filter(existingCommand => existingCommand.match(regexp));
        } else {
            return command;
        }
    });
}

/** Set keeping track of which commands are currently running (in parallel mode) */
const runningCommands = new Set<string>();

/** Buffers used to record outputs of commands in parallel mode. */
const buffers = new Map<string, Array<{ stream: Writable, text: string }>>();

/**
 * @returns The first command in the parallel executed command queue or null if queue is empty.
 */
function getPrimaryCommand(): string | null {
    const [ command ] = runningCommands;
    return command ?? null;
}

/**
 * Prints a text to given stream. This either happens directly if command is the primary command or is buffered otherwise.
 *
 * @param stream  - The stream to write the text to.
 * @param text    - The text to write.
 * @param command - The command which produces the text.
 */
function write(stream: Writable, text: string, command: string): void {
    if (getPrimaryCommand() === command) {
        // When command is the primary command then write it to target stream directly
        stream.write(text);
    } else {
        // Otherwise append text to buffer
        let buffer = buffers.get(command);
        if (buffer == null) {
            buffers.set(command, buffer = []);
        }
        buffer.push({ stream: stream, text });
    }
}

/**
 * Flushes the buffer of the given command.
 *
 * @param command - The command for which to flush the buffer.
 */
function flush(command: string | null): void {
    if (command != null) {
        const buffer = buffers.get(command);
        if (buffer != null) {
            for (const data of buffer) {
                data.stream.write(data.text);
            }
            buffers.delete(command);
        }
    }
}

/**
 * Flush output of all remaining commands which have not yet been flushed.
 */
function flushAll(): void {
    for (const command of buffers.keys()) {
        flush(command);
    }
}

/**
 * Runs given command with given options.
 *
 * @param command - The command to run.
 * @param options - The run options.
 */
async function runCommand(command: string, { parallel, silent }: RunOptions): Promise<void> {
    const npmOptions: string[] = [];
    if (silent) {
        npmOptions.push("-s");
    }

    // Record command (only needed during parallel execution)
    runningCommands.add(command);

    return new Promise((resolve, reject) => {
        // Build environment based on current environment plus optionally added FORCE_COLOR variable for parallel execution. When command output is
        // buffered then programs can't check the output stream for color support. Setting FORCE_COLOR helps for most programs, but not all.
        let env = { ...process.env };
        if (parallel) {
            env.FORCE_COLOR ??= String(getColorLevel());
        }

        // Start NPM command
        const child = spawn("npm", [ "run", ...npmOptions, command ],
            { stdio: [ "inherit", parallel ? "pipe" : "inherit", parallel ? "pipe" : "inherit" ], env });

        // When parallel execution then handle buffered output
        if (parallel && child.stdout != null && child.stderr != null) {
            const bufferStream = (stream: Readable, target: Writable) => {
                stream.on("data", (chunk) => {
                    write(target, chunk, command);
                });
            }
            bufferStream(child.stdout, process.stdout);
            bufferStream(child.stderr, process.stderr);
        }

        child.on("error", reject);
        child.on("close", (code) => {
            // Remove command from list of running commands
            runningCommands.delete(command);

            // Flush buffer of current primary command so this command can continue writing output directly to console
            flush(getPrimaryCommand());

            // Handle exit code
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} exited with code ${code}`));
            }
        });
    });
}

/**
 * Runs the given commands.
 *
 * @param commands - The commands to run. Can use asterisk character as wildcard.
 * @param options  - The run options.
 */
async function run(commands: string[], options: RunOptions): Promise<void> {
    commands = await resolveCommands(commands);
    if (options.parallel && commands.length > 1) {
        const promises: Array<Promise<void>> = [];
        const errors: Error[] = [];

        // Start all commands in parallel and gather errors
        for (const command of commands) {
            const promise = runCommand(command, options);
            promise.catch(error => errors.push(error));
            promises.push(promise);
        }

        // Wait for all parallel script executions to be finished (success or error)
        await Promise.allSettled(promises);

        // Flush remaining buffered output
        flushAll();

        // Handle gathered errors
        if (errors.length == 1) {
            throw errors[0];
        } else if (errors.length > 1) {
            const messages = errors.map(error => error instanceof Error ? error.message : String(error));
            throw new AggregateError(errors, `Execution of ${errors.length} commands failed\n  ${messages.join("\n  ")}`);
        }
    } else {
        // Run all commands sequentially
        for (const command of commands) {
            await runCommand(command, { ...options, parallel: false });
        }
    }
}

/** The help text. */
const help = `Usage: run [OPTION]... [COMMAND]...

Runs given package script commands.

Options:
  --parallel, -p      Run commands in parallel instead of sequentially.
  --silent, -s        Passes --silent option to NPM.
  --help              display this help and exit
  --version           output version information and exit

Report bugs to <${packageJSON.bugs}>.`;

/** The version text. */
const version = `run ${packageJSON.version}

Written by ${packageJSON.author.name} <${packageJSON.author.email}>`;

/**
 * Main function.
 *
 * @param args - The command line arguments (`process.argv.slice(2)`)
 * @returns The exit code
 */
export async function main(args: string[]): Promise<number> {
    try {
        const { values, positionals } = parseArgs({
            args,
            allowPositionals: true,
            options: {
                parallel: { type: "boolean", short: "p", default: false },
                silent: { type: "boolean", short: "s", default: false },
                help: { type: "boolean", default: false },
                version: { type: "boolean", default: false }
            }
        });

        if (values.help) {
            console.log(help);
            return 0;
        }

        if (values.version) {
            console.log(version);
            return 0;
        }

        if (positionals.length === 0) {
            console.error("run: missing script name\nTry 'cmd --help' for more information.");
            return 2;
        }

        const options: RunOptions = {
            parallel: values.parallel,
            silent: values.silent
        };

        await run(positionals, options);
        return 0;
    } catch (error) {
        console.error("run:", error instanceof Error ? error.message : String(error));
        return 1;
    }
}

if (import.meta.main) {
    process.exitCode = await main(process.argv.slice(2));
}
