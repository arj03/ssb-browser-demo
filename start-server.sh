#!/usr/bin/env bash
npm install
npm run build
pushd dist
npx http-server
popd
