#!/bin/bash

rm -rf build
mkdir -p build
cp *.html build/
cp *.css build/
# uglifyjs script.js -o script.min.js -c -m --mangle-props

for file in *.js; do
  if [[ $file != *.min.js ]]; then
    output="${file%.js}.js"
    uglifyjs "$file" -o build/"$output" -c -m --toplevel --mangle-props
    echo "Minified and obfuscated $file -> $output"
  fi
done