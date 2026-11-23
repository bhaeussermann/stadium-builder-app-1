'use strict';

const fs = require('fs');
const path = require('path');
// Layout paths come from the layout SSOT (resolve-state-path.js), so the
// generated-docs root is written down once and this check can't drift from it.
const { PROJECT_MD_PATH } = require('../resolve-state-path');

/**
 * Classify a project directory the same way for every workflow view, so /dashboard
 * and the build reports never disagree on whether a project exists.
 * Returns 'ok' | 'no_project'. Callers own the user-facing
 * message for each status — the wording differs by surface.
 */
function projectStatus(root) {
  return fs.existsSync(path.join(root, PROJECT_MD_PATH)) ? 'ok' : 'no_project';
}

module.exports = { projectStatus };
