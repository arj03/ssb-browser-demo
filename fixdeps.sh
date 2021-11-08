#!/usr/bin/env bash
# Fix module issues in dependencies.
sed -i '/"module"/d' node_modules/\@minireq/common/package.json
sed -i '/"module"/d' node_modules/\@minireq/node/package.json
sed -i '/"module"/d' node_modules/\@minireq/browser/package.json
