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
const axios = require ('axios').create(axiosDefaultConfig);

if (process.argv.length != 3) {
  console.log("Usage: %s [package name]", process.argv[1]);
  process.exit(0);
}

var packageName = process.argv[2];
const npmRegistry = "https://registry.npmjs.org"

// change work directory
const packsDirName = 'packs'
if(!fs.existsSync(packsDirName)){
  fs.mkdirSync(packsDirName, (err) => {
    if(err){
      console.log("Error making packs directory: ", err)
      process.exit(1)
    }
  })
}

// pack dependencies recursively
function packDeps(deps, depth) {
  console.log("deps: ", deps)
  console.log("depth: ", depth)
  if (!deps || deps.length == 0 || depth > 10) {
    return
  }

  for (pkgName of deps) {
    doPack(pkgName, depth)
  }
}

function doPack(pkgName, depth) {
  if(!pkgName){
    return
  }

  let packageName= pkgName
  let pkgWithVer = pkgName
  let packageVersion = 'latest'
  if (packageName.includes("@")) {
    const parts = packageName.split('@')
    packageName = parts[0]
    packageVersion = parts[1]
  }

  cp.exec('npm pack ' + pkgWithVer, {maxBuffer: 1024 * 500}, function(err, stdout, stderr) {
    console.log(stdout);
    console.error(stderr); 
  
    if (err) {
      console.log("Error executing npm pack: ", err);
      // process.exit
      return
    }
  });

  axios.get(`${packageName}/${packageVersion}`)
  .then(({data}) => {
    if(data.dependencies){
      let deps = []
      for(let [key, value] of Object.entries(data.dependencies)) {
        value = value.replace("^", "")
        deps.push(`${key}@${value}`)
      }

      packDeps(deps, depth+1)
    }
  })
  .catch(err => {
    console.log("error: ", err)
  })
}

packDeps([packageName], 0)


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