const inmem = require('lucass/inmemory')
const test = require('tap').test
const contentfs = require('../')

test(`filter: normal function filter`, async t => {
  t.plan(2)
  let local = inmem()
  let remote = inmem()
  let filter = path => path.endsWith('_deepTree')
  let store = await contentfs.from(__dirname, local, remote, filter)
  let files = await store.ls('/')
  t.same(['_deepTree'], files)
  let hashes = await store.activeHashes()
  t.same(hashes.length, 5)
})

test(`filter: async function filter`, async t => {
  t.plan(2)
  let local = inmem()
  let remote = inmem()
  let filter = async path => path.endsWith('_deepTree')
  let store = await contentfs.from(__dirname, local, remote, filter)
  let files = await store.ls('/')
  t.same(['_deepTree'], files)
  let hashes = await store.activeHashes()
  t.same(hashes.length, 5)
})
