/*
 * This script will download a package (and all of its dependencies) from the 
 * online NPM registry, then create a gzip'd tarball containing that package 
 * and all of its dependencies. This archive can then be copied to a machine
 * without internet access and installed using npm.
 *
 * The idea is pretty simple:
 *  - npm install [package]
 *  - rewrite [package]/package.json to copy dependencies to bundleDependencies
 *  - npm pack [package]
 *
 *  It is necessary to do this (intead of using pac) because when npm installs
 *  a module, it will actually strip out the node_modules folder from the 
 *  tarball unless bundleDependencies is set.
 *
 *  Author: Jack Gill (https://github.com/jackgill)
 *  Date: 11/27/2013
 *  License: MIT License (see end of file)
 */

var fs = require('fs');
var cp = require('child_process');
var path = require('path');
const { exit } = require('process');
const HttpsProxyAgent = require('https-proxy-agent');
const axiosDefaultConfig = {
  baseURL: 'https://r.cnpmjs.org',
  proxy: false,
  httpsAgent: new HttpsProxyAgent('http://10.0.2.2:41091')
};
const axios = require('axios').create(axiosDefaultConfig);

if (process.argv.length != 3) {
  console.log("Usage: %s [--pkg=pkgName] [--file=package.json path]", process.argv[1]);
  process.exit(0);
}

const argParts = process.argv[2].split('=');
if (argParts.length != 2) {
  process.exit(0)
}

const MAX_DEPTH = 10
const checkedPkgs = []

// create tarball directory
const packsDirName = 'packs'
if (!fs.existsSync(packsDirName)) {
  fs.mkdirSync(packsDirName, (err) => {
    if (err) {
      console.log("Error making packs directory: ", err)
      process.exit(1)
    }
  })
}

function passDependencies(fileName, isDev) {
  var contents = fs.readFileSync(fileName);
  var json = JSON.parse(contents);

  let deps = []
  let dependencies = json.dependencies
  if (isDev) {
    dependencies = json.devDependencies
  }
  if (dependencies) {
    for (let [key, value] of Object.entries(dependencies)) {
      value = value.replace("^", "")
      deps.push(`${key}@${value}`)
    }
  }
  return deps
}

// pack dependencies recursively
function packDeps(deps, depth) {
  console.log("depth: ", depth, "deps: ", deps)
  if (!deps || deps.length == 0 || depth > MAX_DEPTH) {
    return
  }

  for (pkgName of deps) {
    doPack(pkgName, depth)
  }
}

function doPack(pkgName, depth) {
  if (!pkgName) {
    return
  }

  let packageName = pkgName
  let pkgWithVer = pkgName
  let packageVersion = 'latest'
  if (packageName.includes("@")) {
    let last = pkgWithVer.lastIndexOf('@')
    packageName = pkgWithVer.substring(0, last)
    packageVersion = pkgWithVer.substring(last + 1)
  }

  // pack packages that not exist
  let fn = packageName.replace('@', '')
  let verpart = ''
  if (packageVersion != 'latest') {
    verpart = '-' + packageVersion.replace('~', '')
  }
  fn = fn.replace('/', '-') + verpart + '.tgz'
  newFN = path.join(packsDirName, fn)
  if (!fs.existsSync(newFN) && !checkedPkgs.includes(pkgWithVer)) {
    cp.exec(`npm pack ${pkgWithVer}`,
      { maxBuffer: 1024 * 500 },
    { maxBuffer: 1024 * 500 }, 
      { maxBuffer: 1024 * 500 },
      packCallback.bind({ "oldPath": fn, "newPath": newFN, "name": packageName, "version": packageVersion, "pkgWithVer": pkgWithVer, "depth": depth }),
    );
  }

  // if (checkedPkgs.includes(pkgWithVer)) {
  //   return
  // }
}

function packCallback(err, stdout, stderr) {
  console.log(stdout);
  console.error(stderr);

  if (err) {
    console.log("Error executing npm pack: ", err);
  }

  try {
    fs.renameSync(this.oldPath, this.newPath)
  } catch (err) {
    console.log("Error rename file: ", err)
  }

  axios.get(`${this.name}/${this.version}`)
    .then(({ data }) => {
      if (data.dependencies) {
        let deps = []
        for (let [key, value] of Object.entries(data.dependencies)) {
          value = value.replace("^", "")
          deps.push(`${key}@${value}`)
        }

        checkedPkgs.push(this.pkgWithVer)
        packDeps(deps, this.depth + 1)
      }
    })
    .catch(err => {
      console.log("error: ", err)
    })
}

let initDeps = []
if (argParts[0] == '--pkg') {
  initDeps.push(argParts[1])
}

if (argParts[0] == '--file') {
  initDeps = passDependencies(argParts[1])
}

if (argParts[0] == '--devfile') {
  initDeps = passDependencies(argParts[1], true)
}

packDeps(initDeps, 0)


/*

   The MIT License (MIT)

Copyright (c) 2013 Jack Gill

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/