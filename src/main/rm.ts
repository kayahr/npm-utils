#!/usr/bin/env node
/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { parseArgs } from "node:util";

import packageJSON from "../../package.json" with { type: "json" };
import type { GlobOptionsWithoutFileTypes, RmOptions } from "node:fs";
import { glob, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Options for {@link removePatterns}.
 */
interface RemovePatternsOptions extends GlobOptionsWithoutFileTypes, RmOptions {
    /** Maximum number of parallel deletions. Default: 64. */
    limit?: number;

    /** Set to true to simulate deletions instead of actually deleting files. */
    dryRun?: boolean;

    /** Set to true to show what has been deleted. */
    verbose?: boolean;
}

/**
 * Resolves a filename (relative or absolute) against given directory.
 *
 * @param file - The file name to resolve.
 * @param dir  - The directory to resolve against. Can be a path or a file URL. If not specified then filename is returned unchanged.
 * @returns The resolved path.
 */
function resolvePath(file: string, dir?: URL | string): string {
    if (dir == null) {
        return file;
    } else if (typeof dir === "string") {
        return resolve(dir, file);
    } else {
        return resolve(fileURLToPath(dir), file);
    }
}

/**
 * Removes the given patterns.
 *
 * @param patterns - The patterns to remove.
 * @param options  - Removal options.
 */
async function removePatterns(patterns: string[], { cwd, exclude, verbose = false, limit = 64, dryRun = false, ...rmOptions }:
        RemovePatternsOptions = {}): Promise<void> {
    const errors: unknown[] = [];
    const tasks = new Set<Promise<void>>();

    // Make sure limit is at least 1
    limit = Math.max(Math.floor(limit), 1);

    // Iterate over specified removal patterns
    for (const pattern of patterns) {
        // Iterate over files matching the current pattern
        for await (const file of glob(pattern, { cwd, exclude })) {
            // Asynchronously remove the file. We don't wait for it, so file removals happen in limited batches. Errors are caught as soon as possible and
            // stored because otherwise Node.js aborts with unhandled promise reject exception.
            const task = (async () => {
                try {
                    const path = resolvePath(file, cwd);
                    if (dryRun) {
                        console.log(`would remove '${path}'`);
                    } else {
                        await rm(
                            path,
                            Object.fromEntries(Object.entries(rmOptions).filter(([ , v ]) => v != null))
                        );
                        if (verbose) {
                            console.log(`removed '${path}'`);
                        }
                    }
                } catch (error) {
                    errors.push(error);
                }
            })();
            tasks.add(task);
            void task.finally(() => tasks.delete(task));

            // When too many deletions are currently running then wait until there is room for more
            while (tasks.size >= limit) {
                await Promise.race(tasks);
            }
        }
    }

    // Wait for all file removals to finish
    await Promise.allSettled(tasks);

    // Throw error if there was any
    if (errors.length === 1) {
        throw errors[0];
    } else if (errors.length > 1) {
        const messages = errors.map(error => error instanceof Error ? error.message : String(error));
        throw new AggregateError(errors, `Failed to remove ${errors.length} files\n  ${messages.join("\n  ")}`);
    }
}

/** The help text. */
const help = `Usage: rm [OPTION]... [PATTERN]...

Remove files and directories.

Options:
  --cwd <dir>         working directory for glob (default: current directory)
  --exclude <path>    exclude pattern (repeatable)
  --force, -f         ignore nonexistent files
  --recursive, -r     remove directories and their contents
  --limit <n>         max concurrent deletions (default: 64)
  --verbose, -v       explain what is being done
  --max-retries <n>   fs.rm retry count (Node option)
  --retry-delay <n>   fs.rm retry delay in ms (Node option)
  --dry-run           don't delete anything, just explain what would be done
  --help              display this help and exit
  --version           output version information and exit

Report bugs to <${packageJSON.bugs}>.`;

/** The version text. */
const version = `rm ${packageJSON.version}

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
                help: { type: "boolean" },
                cwd: { type: "string" },
                exclude: { type: "string", multiple: true },
                force: { type: "boolean", short: "f" },
                recursive: { type: "boolean", short: "r" },
                limit: { type: "string" },
                verbose: { type: "boolean", short: "v" },
                version: { type: "boolean" },
                "max-retries": { type: "string" },
                "retry-delay": { type: "string" },
                "dry-run": { type: "boolean" }
            }
        });

        if (values.help === true) {
            console.log(help);
            return 0;
        }

        if (values.version === true) {
            console.log(version);
            return 0;
        }

        if (positionals.length === 0) {
            console.error("rm: missing pattern\nTry 'rm --help' for more information.");
            return 2;
        }

        const options: RemovePatternsOptions = {
            cwd: values.cwd,
            exclude: values.exclude,
            force: values.force,
            recursive: values.recursive,
            verbose: values.verbose,
            dryRun: values["dry-run"],
            limit: values.limit != null ? Number(values.limit) : undefined,
            maxRetries: values["max-retries"] != null ? Number(values["max-retries"]) : undefined,
            retryDelay: values["retry-delay"] != null ? Number(values["retry-delay"]) : undefined
        };

        await removePatterns(positionals, options);
        return 0;
    } catch (error) {
        console.error("rm:", error instanceof Error ? error.message : String(error));
        return 1;
    }
}

if (import.meta.main) {
    process.exitCode = await main(process.argv.slice(2));
}
