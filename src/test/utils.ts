import type { it } from "node:test";

export function captureOutput(t: it.TestContext): { stdout: string, stderr: string, restore: () => void } {
    const output = {
        stdout: "",
        stderr: "",
        restore: () => {
            stdoutMock.mock.restore();
            stderrMock.mock.restore();
        }
    }
    const stdoutMock = t.mock.method(process.stdout, "write", (text: string) => { output.stdout += text; });
    const stderrMock = t.mock.method(process.stderr, "write", (text: string) => { output.stderr += text; });
    return output;
}
