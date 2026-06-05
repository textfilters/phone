# @textfilters/phone

Phone-like sequence filtering for composable text moderation.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/phone
```

## Usage

```ts
import { filter } from "@textfilters/phone";

const safeText = filter.censor("call +1 555 010 9999");
```

```ts
import { createPhoneFilter } from "@textfilters/phone";

const phoneFilter = createPhoneFilter({ maskChar: "#" });
const safeText = phoneFilter.censor("call 8 999 123 45 67");
```

The default shared instance is exported as `filter`. It has stable `name: "phone"`.

## Behavior

The package detects phone-like numeric sequences across common RU and international formats, including Unicode digit forms that normalize to ASCII digits for matching.

False-positive guards keep date-like, time-like, coordinate-like, IP/server-like, and balance-like numeric text outside the masked range.

`censor()` preserves the original JavaScript string length and is idempotent.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the parser flow, module map,
and change guide.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
