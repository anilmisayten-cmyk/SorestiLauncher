# Code Signing Policy

This project signs and distributes release artifacts.

## Windows

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

### What will be signed

- Windows installer packages (`.exe`) published on GitHub Releases

### Build and signing process

- Artifacts are built from this repository using GitHub Actions
- Signed via SignPath's GitHub Action integration
- Signed artifacts are published as GitHub Releases
