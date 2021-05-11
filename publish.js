const fs = require('fs');
const cp = require('child_process');
const process = require('process');
const path = require('path');
const stream = require('stream')
var tar = require('tar');
var rimraf = require('rimraf')

if (process.argv.length != 3) {
    console.log("Usage: %s [dir name]", process.argv[1]);
    process.exit(0);
}

const dir = process.argv[2];
let files = fs.readdirSync(dir)
if (files.length == 0) {
    return
}

for (fn of files) {
    let tarball = path.join(dir, fn)
    cp.exec('npm publish' + tarball, (error, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)

        if (error) {
            if (stderr.includes('request to https://wombat-dressing-room.appspot.com')) {
                tmpDir = tarball + '-tmp'
                if (!fs.existsSync(tmpDir)) {
                    fs.mkdirSync(tmpDir)
                }

                tar.extract({
                    C: tmpDir,
                    file: tarball,
                }).then(_ => {
                    let filename = path.join(tmpDir, 'package', 'package.json')
                    let contents = fs.readFileSync(filename)
                    let meta = JSON.parse(contents)
                    if (meta.publishConfig) {
                        console.log("will remove publish config:", meta.publishConfig)
                        meta.publishConfig = undefined
                        fs.writeFileSync(filename, JSON.stringify(meta, null, 2))

                        let tmpFile = tarball + '.tmp'
                        tar.create({ gzip: true, C: tmpDir, file: tmpFile }, ['package'])
                            .then(_ => {
                                try {
                                    fs.renameSync(tmpFile, tarball)
                                    rimraf.sync(tmpDir)
                                } catch (err) {
                                    console.log("Error: ", err)
                                }
                            })
                    }
                })
            }
        }
    })
}