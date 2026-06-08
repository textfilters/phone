# Changelog

## [0.1.2](https://github.com/textfilters/phone/compare/v0.1.1...v0.1.2) (2026-06-08)


### Bug Fixes

* added phone regression coverage ([a6745b7](https://github.com/textfilters/phone/commit/a6745b78fc2a051296f4bcbac8ea308da69c63b6))

## [0.1.1](https://github.com/textfilters/phone/compare/v0.1.0...v0.1.1) (2026-06-08)


### Bug Fixes

* added phone regression coverage ([a6745b7](https://github.com/textfilters/phone/commit/a6745b78fc2a051296f4bcbac8ea308da69c63b6))

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/phone`.

- Phone-like sequence censor with a small `filter` export and configurable `createPhoneFilter(...)` factory.
- Unicode digit normalization for matching non-ASCII digit forms.
- RU and international phone-format coverage.
- False-positive guards for dates, times, coordinates, IP/server-like text, and balance-like numeric text.
- Architecture documentation and GitHub Packages release flow.
