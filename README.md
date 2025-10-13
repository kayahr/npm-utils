# npm-utils

[GitHub] | [NPM]

Cross-platform CLI utilities for use in *package.json* scripts.

Requirements:

* [Node.js] >=22.18.0

Currently available tools:

* `rm` — Remove files and directories
* `run` — Run npm scripts in parallel or sequentially

The goal of this project is to provide zero-dependency alternatives to tools like [rimraf] and [npm-run-all]. All commands rely only on built-in Node.js functionality.

## Usage

Install as a development dependency:

```
npm install -DE @kayahr/npm-utils
```

Then use the commands in your *package.json*:

```json
{
    "scripts": {
        "clean": "rm -rf lib",
        "build": "run build:*",
        "build:compile": "tsc",
        "build:bundle": "esbuild",
        "prepare": "run clean build"
    }
}
```

To see available options and flags, run a tool with the `--help` option:

```sh
$ npx rm --help
```

When using glob patterns in options, enclose them in single quotes. On some operating systems (such as most Unix shells), glob patterns are expanded by the shell itself, which can lead to unexpected results. Other systems, like Windows, typically do not expand them.

Always use forward slashes (`/`) as directory separators. They work consistently on both Unix and Windows.

## Commands

### rm

Removes files and directories. The syntax mimics the Unix `rm` command.

### run

The `run` command can be used to call multiple other NPM scripts and supports wildcards `*` and `**`. This works similar to path globbing but with the difference that script hierarchies are using the colon (`:`) character as separator instead of slashes.

Example:

```json
{
    "scripts": {
        "build": "run build:*",
        "build:compile": "tsc",
        "build:schema": "run -p build:schema:*",
        "build:schema:ships": "schema-generator ships",
        "build:schema:stations": "schema-generator stations",
        "build:example": "run -p build:example:*",
        "build:example:ships": "schema-generator ships",
        "build:example:stations": "schema-generator stations",
    }
}
```

The pattern `build:*` matches the scripts `build:compile`, `build:schema` and `build:example` but not the sub schema and example scripts. The pattern `build:**` would match all seven build scripts. The pattern `build:*:ships` would match `build:schema:ships` and `build:example:ships`.

By default scripts are executed sequentially and execution halts on first error. With the `-p` (or `--parallel`) option the matched scripts are executed in parallel instead. In parallel execution the outputs of the commands are buffered to prevent chaotic mixed output. If the executed programs do not support the `FORCE_COLOR` environment variable then colored output might get lost because of the buffering and you may need to specify proprietary options to force color output. `cspell` for example ignores the `FORCE_COLOR` environment variable and needs an explicit `--color` option to enable colors.

[GitHub]: https://github.com/kayahr/npm-utils
[NPM]: https://www.npmjs.com/package/@kayahr/npm-utils
[rimraf]: https://www.npmjs.com/package/rimraf
[copyfiles]: https://www.npmjs.com/package/copyfiles
[npm-run-all]: https://www.npmjs.com/package/npm-run-all
[Node.js]: https://nodejs.org/
