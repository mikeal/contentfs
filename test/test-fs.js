const fs = require('fs')
const path = require('path')
const test = require('tap').test
const promisify = require('util').promisify
const inmem = require('lucass/inmemory')
const infs = require('lucass/fs')
const rimraf = require('rimraf')
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
        let _file = await store.get(relative + f)
        t.same(file, _file)
      }
    }
  }
  return walk(__dirname, '/')
})

let folder = path.join(require('os').tmpdir(), Math.random().toString())
fs.mkdirSync(folder)

let createFolder = () => {
  let f = path.join(folder, Math.random().toString())
  fs.mkdirSync(f)
  return infs(f)
}

require('./lib').forEach(fn => {
  fn('fs', createFolder, createFolder)
})

test('fs: teardown', t => {
  t.plan(1)
  rimraf.sync(folder)
  t.ok(true)
})
