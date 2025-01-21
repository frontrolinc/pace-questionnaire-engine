module.exports = {
  git: {
    commitMessage: "chore: Release v${version}",
    tagName: "v${version}",
    requireCommits: true, // require commits since last tag
    requireCleanWorkingDir: false, // exits if local not upto date with remote or if workdir is unclean
  },
  github: {
    release: true, // creates a github release
    draft: true, // github releases are only drafted, confirm the draft in github releases page to publish it
    releaseName: "✨ v${version}",
    commitArgs: ["-S"], // creates gpg signed commits
    tagArgs: ["-s"], // creates gpg signed tags
    assets: ["tar/*.tgz"], // assets to be included in the GitHub releases page
  },
  npm: {
    publish: true,
  },
  hooks: {
    // runs lint before publishing
    "before:init": ["npm install"],
    // build the package to publish and the generate a tarball for use in github releases
    // "after:bump": "npm run rollup",
    "after:release":
      "echo Successfully created a release v${version} for ${repo.repository}.",
  },
};