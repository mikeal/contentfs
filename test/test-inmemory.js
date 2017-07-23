const inmem = require('lucass/inmemory')
const lib = require('./lib')
const contentfs = require('../')
const test = require('tap').test

lib.forEach(fn => {
  fn('inmemory', inmem, inmem)
})

test(`inmemory: concurrent updates during activeHashes`, async t => {
  t.plan(2)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  let root = await store.set('/testfile.txt', Buffer.from('asdfasff'))
  let _promise = store.activeHashes()
  store.set('/anotherfile.txt', Buffer.from('asdfasdfafasdfasdff'))
  let hashes = await _promise
  t.notsame(root, store._root)
  let hash = root.slice(0, root.indexOf('.'))
  t.ok(hashes.indexOf(hash) === -1)
})
