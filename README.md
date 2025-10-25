# npm-utils

[GitHub] | [NPM]

Cross-platform CLI utilities for use in *package.json* scripts.

Requirements:

* [Node.js] >=22.18.0

Currently available tools:

* `rm` - Remove files and directories
* `cp` - Copies files and directories
* `run` - Run npm scripts in parallel or sequentially

The goal of this project is to provide zero-dependency alternatives to tools like [rimraf], [copyfiles] and [npm-run-all]. All commands rely only on built-in Node.js functionality.

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
        "build:copy": "cp -rf src/assets/ lib/assets/",
        "build:bundle": "esbuild",
        "prepare": "run clean build"
    }
}
```

To see available options and flags, run a tool with the `--help` option:

```sh
$ npx rm --help
$ npx cp --help
$ npx run --help
```

When using glob patterns in options, enclose them in single quotes. On some operating systems (such as most Unix shells), glob patterns are expanded by the shell itself, which can lead to unexpected results. Other systems, like Windows, typically do not expand them.

Always use forward slashes (`/`) as directory separators. They work consistently on both Unix and Windows.

## Commands

### rm

Removes files and directories. Without any options it removes the given file/files without recursion into directories. The command fails when a specified path does not exist or is a directory. Use the `-r` or `--recursive` option to delete directories and their contents. Use the `-f` or `--force` option to ignore non-existent files. Usually this is combined into a short `-rf` option. When your project compiles TypeScript sources from the `src` directory to the `lib` directory then you most likely want to use `rm -rf lib` in you package.json clean script to completely remove the `lib` directory, no matter if it exists or was already deleted.

The command accepts glob patterns, like `rm 'lib/**/*.js'`. Make sure to put glob patterns into quotes to prevent your shell from expanding them.

For more options call `npx rm --help` on the command line in your project root.

### cp

Copies files and directories. Without any options it copies a single file to a given target location, or multiple files into a given target directory. The command fails when one of the sources is a directory or the destination already exists. Use the `-r` or `--recursive` option to recursively copy directories. Use the `-f` or `--force` option to overwrite existing files. This is usually combined into a short `-rf` option.

Recursively copied directory content can be filtered with the repeatable `--exclude` and `--include` options which supports simple glob patterns (`*`, `**` and `?` wildcards). Example: `cp -rf src/assets lib/images --include '**/*.png'`. This only copies files By default nothing is excluded and everything is included. When specifying custom includes then only the matching files are included, as long as they don't match a given exclude rule.

For more options call `npx cp --help` on the command line in your project root.

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
[rm]: https://nodejs.org/api/fs.html#fspromisesrmpath-options
[cp]: https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options
