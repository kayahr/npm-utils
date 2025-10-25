#!/usr/bin/env node
/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { parseArgs } from "node:util";

import packageJSON from "../../package.json" with { type: "json" };
import type { CopyOptions } from "node:fs";
import { cp, glob, lstat, mkdir } from "node:fs/promises";
import { getErrorMessage } from "./utils/error.ts";
import { basename, join, matchesGlob, relative } from "node:path";
import { resolvePath } from "./utils/fs.ts";

/**
 * Options for {@link copy}.
 */
interface CpOptions extends CopyOptions {
    /** The current working directory for relative source paths. */
    cwd?: string;

    /** Use full source file name under target directory */
    parents?: boolean;

    /** Set to true to simulate copying instead of actually copying files. */
    dryRun?: boolean;

    /** Set to true to show what has been copied. */
    verbose?: boolean;

    /** Always follow symbolic links in source. */
    dereference?: boolean;

    /** Exclude glob patterns relative to source. */
    exclude?: string[];

    /** Include glob patterns relative to source. */
    include?: string[];

}

async function getFiles(sources: string[], cwd?: string, exclude?: string[]): Promise<string[]> {
    const files: string[] = [];
    for (const source of sources) {
        let found = false;
        for await (const file of glob(source, { cwd, exclude })) {
            found = true;
            files.push(file);
        }
        if (!found) {
            throw new Error(`source path '${source}' did not match any file or directory`);
        }
    }
    return files;
}

/**
 * Copies the given source glob patterns to the given target.
 *
 * @param patterns    - The sources glob patterns to copy.
 * @param destination - The destination to copy to.
 * @param options     - Copy options.
 */
async function copy(patterns: string[], destination: string, { cwd, parents = false, include = [], exclude = [], verbose = false, dryRun = false, ...cpOptions }:
        CpOptions = {}): Promise<void> {
    const files = await getFiles(patterns, cwd);

    // When more than one file is specified to copy or parents option is set then destination must be a directory
    let destIsDir = false;
    if (files.length > 1 || parents) {
        if (!dryRun) {
            await mkdir(destination, { recursive: true });
        }
        destIsDir = true;
    }

    for (const source of files) {
        const destFile = destIsDir ? join(destination, parents ? source : basename(source)) : destination;
        const filter = async (file: string): Promise<boolean> => {
            if (source  === file) {
                return true;
            }
            const relativeFile = (source === file || parents || cwd != null) ? file : relative(source, file);
            if (verbose && (include.length > 0 || exclude.length > 0)) {
                console.log(`Filtering '${relativeFile}'`);
            }
            for (const glob of exclude) {
                if (matchesGlob(relativeFile, glob)) {
                    if (verbose) {
                        console.log(`Excluding '${relativeFile}'`);
                    }
                    return false;
                }
            }
            if (include.length === 0 || (await lstat(file)).isDirectory()) {
                return true;
            }
            for (const glob of include) {
                if (matchesGlob(relativeFile, glob)) {
                    if (verbose) {
                        console.log(`Including '${relativeFile}'`);
                    }
                    return true;
                }
            }
            return false;
        };
        if (dryRun) {
            console.log(`Would copy '${source}' to '${destFile}'`);
        } else {
            await cp(resolvePath(source, cwd), destFile, {
                filter,
                errorOnExist: true,
                preserveTimestamps: true,
                ...Object.fromEntries(Object.entries(cpOptions).filter(([ , v ]) => v != null))
            });
            if (verbose) {
                console.log(`Copied '${source}' to '${destFile}'`);
            }
        }
    }
}

/** The help text. */
const help = `Usage: cp [OPTION]... [SOURCE]... DEST

Copies files and directories.

Options:
  --cwd <dir>         working directory for relative source paths (default: current directory)
  --exclude <path>    exclude pattern (repeatable)
  --include <path>    include pattern (repeatable)
  --dereference, -L   always follow symbolic links in SOURCE
  --force, -f         overwrite existing files and directories
  --recursive, -r     copy directories and their contents
  --verbose, -v       explain what is being done
  --parents           use full source file name under target directory
  --dry-run           don't copy anything, just explain what would be done
  --help              display this help and exit
  --version           output version information and exit

Report bugs to <${packageJSON.bugs}>.`;

/** The version text. */
const version = `cp ${packageJSON.version}

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
                dereference: { type: "boolean", short: "L" },
                exclude: { type: "string", multiple: true },
                include: { type: "string", multiple: true },
                force: { type: "boolean", short: "f", default: false },
                recursive: { type: "boolean", short: "r", default: false },
                verbose: { type: "boolean", short: "v" },
                version: { type: "boolean" },
                parents: { type: "boolean" },
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

        const sources = positionals.slice();
        const destination = sources.pop();

        if (destination == null) {
            console.error("cp: missing destination file operand\nTry 'cp --help' for more information.");
            return 2;
        }

        if (sources.length === 0) {
            console.error("cp: missing source file operand\nTry 'cp --help' for more information.");
            return 2;
        }

        const options: CpOptions = {
            cwd: values.cwd,
            exclude: values.exclude,
            include: values.include,
            force: values.force,
            recursive: values.recursive,
            dereference: values.dereference,
            verbose: values.verbose,
            parents: values.parents,
            dryRun: values["dry-run"]
        };

        await copy(sources, destination, options);
        return 0;
    } catch (error) {
        console.error("cp:", getErrorMessage(error));
        return 1;
    }
}

if (import.meta.main) {
    process.exitCode = await main(process.argv.slice(2));
}
