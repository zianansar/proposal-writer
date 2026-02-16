// upwork-researcher/.versionrc.cjs
// Configuration for commit-and-tag-version (semantic versioning automation)
//
// Release workflow:
//   1. Run: npm run version:bump (or version:bump:minor/major)
//   2. Bumps version in 3 files, updates CHANGELOG, commits, and creates v* tag
//   3. Push tag: git push --follow-tags origin main
//   4. GitHub Actions (release.yml) detects v* tag, builds Tauri app, creates draft release
//   5. release.yml extracts CHANGELOG section into GitHub Release body (AC-5)
//
// Custom TOML updater for Cargo.toml version field under [package]
const tomlUpdater = {
  readVersion(contents) {
    const match = contents.match(/^\[package\]\s*\n(?:.*\n)*?version\s*=\s*"([^"]+)"/m);
    return match ? match[1] : undefined;
  },
  writeVersion(contents, version) {
    return contents.replace(
      /(^\[package\]\s*\n(?:.*\n)*?version\s*=\s*")([^"]+)(")/m,
      `$1${version}$3`,
    );
  },
};

module.exports = {
  packageFiles: [{ filename: "package.json", type: "json" }],
  bumpFiles: [
    { filename: "package.json", type: "json" },
    { filename: "src-tauri/Cargo.toml", updater: tomlUpdater },
    { filename: "src-tauri/tauri.conf.json", type: "json" },
  ],
  hooks: {
    postbump:
      "cd src-tauri && cargo check --quiet 2>/dev/null; cd .. && git add src-tauri/Cargo.lock",
  },
  releaseCommitMessageFormat: "chore: release v{{currentTag}}",
  tagPrefix: "v",
  types: [
    { type: "feat", section: "Features" },
    { type: "fix", section: "Bug Fixes" },
    { type: "perf", section: "Performance" },
    { type: "refactor", section: "Refactoring" },
    { type: "docs", section: "Documentation", hidden: true },
    { type: "style", section: "Styles", hidden: true },
    { type: "chore", section: "Maintenance", hidden: true },
    { type: "test", section: "Tests", hidden: true },
    { type: "ci", section: "CI/CD", hidden: true },
    { type: "build", section: "Build", hidden: true },
  ],
};
