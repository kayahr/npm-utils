/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

/**
 * Returns the error message of the given error.
 *
 * @param error - The error from which to extract the error message.
 * @returns The extracted error message.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Converts the given unknown error type to an explicit error type. If given error is already an instance of Error then it is returned unchanged.
 *
 * @param error - The error to convert to an Error instance.
 * @returns The error instance.
 */
export function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
