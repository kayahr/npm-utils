/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

/**
 * Returns the color level supported on stdout and stderr. Can be written to FORCE_COLOR environment variable to pass actual color level through to piped
 * sub processes.
 *
 * @returns The color level (0 = Monochrome, 1 = 16 colors, 2 = 256 colors, 3 = True color)
 */
export function getColorLevel(): number {
    switch (Math.min(process.stdout.getColorDepth?.() ?? 1, process.stderr.getColorDepth?.() ?? 1)) {
        case 4:
            // 16 colors
            return 1;
        case 8:
            // 256 colors
            return 2;
        case 24:
            // True color
            return 3;
        default:
            // Monochrome fallback
            return 0;
    }
}
