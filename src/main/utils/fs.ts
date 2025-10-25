/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { resolve } from "node:path";

/**
 * Resolves a filename (relative or absolute) against given directory.
 *
 * @param file - The file name to resolve.
 * @param dir  - The directory to resolve against. If not specified then filename is returned unchanged.
 * @returns The resolved path.
 */
export function resolvePath(file: string, dir?: string): string {
    return dir == null ? file : resolve(dir, file);
}
