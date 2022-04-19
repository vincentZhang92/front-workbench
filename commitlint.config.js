const Configuration = {
  /*
   * Resolve and load @commitlint/config-conventional from node_modules.
   * Referenced packages must be installed
   */
  extends: ['@commitlint/config-conventional'],
  /*
   * Any rules defined here will override rules from @commitlint/config-conventional
   */
  rules: {
    // body begins with blank line
    'body-leading-blank': [2, 'always'],
    // footer begins with blank line
    'footer-leading-blank': [2, 'always'],
    // header has value or less characters
    'header-max-length': [2, 'always', 108],
    // subject is in case value
    'subject-case': [0],
    // scope can be empty
    'scope-empty': [2, 'never'],
    // subject is empty
    'subject-empty': [2, 'never'],
    // type is found in value
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'style',
        'docs',
        'test',
        'refactor',
        'build',
        'ci',
        'chore',
        'revert',
        'wip',
        'workflow',
        'types',
        'release'
      ]
    ],
    // type is empty
    'type-empty': [2, 'never']
  },
  /*
   * Functions that return true if commitlint should ignore the given message.
   */
  ignores: [commit => commit.includes('init')]
};

module.exports = Configuration;
