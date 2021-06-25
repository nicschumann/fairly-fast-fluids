#!/bin/bash


git checkout -D pre-gh-pages
git checkout -D gh-pages

git checkout -b pre-gh-pages
echo "!dst/bundle*" >> .gitignore
echo "!dst/*.woff" >> .gitignore
echo "!dst/*.eot" >> .gitignore
echo "!dst/*.ttf" >> .gitignore

mkdir -p dst/src
cp src/data dst/src

git add dst .gitignore
git commit -m "[pre-deploy] adds compiled assets to subtree."

# split and deploy
git subtree split --prefix dst -b gh-pages
git push -f origin gh-pages:gh-pages

git checkout master
git branch -D pre-gh-pages
git branch -D gh-pages
# git branch -D gh-pages

rm -r dst/src
