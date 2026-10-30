# tex-linebreak 0.9.0

Unmodified browser bundle and source map from the official npm package.

- Author: Robert Knight
- License declared by the package: MIT
- Source: https://github.com/robertknight/tex-linebreak
- Package: https://registry.npmjs.org/tex-linebreak/-/tex-linebreak-0.9.0.tgz
- npm integrity: `sha512-yimhmfKUf9q80vptG33sMa/KqE/EyZatMOWD43yN5a7vm65zacaAAekmwZcul1fRF+nPGdCTPj4Ppw5ZuB4yxA==`

The bundle is stored locally so the trial also works when opening index.html
directly, without a CDN, npm installation, or build step. It exposes
`window.texLineBreak_lib`; integration lives in `../../../typography.js`.
The English (US) hyphenation bundle and source map also come unmodified from
the same npm package. The integration restricts hyphenation to long lowercase
words and keeps at least three letters on each side of a break.
