const fs = require('fs')
const path = require('path')
const test = require('tap').test
const promisify = require('util').promisify
const inmem = require('lucass/inmemory')
const contentfs = require('../')

test('fs: test from API', async t => {
  let store = await contentfs.from(__dirname, inmem(), inmem())
  let readdir = promisify(fs.readdir)
  let stat = promisify(fs.stat)
  let readfile = promisify(fs.readFile)
  let walk = async (dir, relative) => {
    let files = await readdir(dir)
    let _files = await store.ls(relative)
    t.same(files, _files)
    for (let f of files) {
      let fullpath = path.join(dir, f)
      let stats = await stat(fullpath)
      if (stats.isDirectory()) {
        await walk(fullpath, relative + f + '/')
      } else {
        let file = await readfile(fullpath)
        let _file = await store.getBuffer(relative + f)
        t.same(file, _file)
      }
    }
  }
  return walk(__dirname, '/')
})
