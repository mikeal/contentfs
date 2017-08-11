const inmem = require('lucass/inmemory')
const test = require('tap').test
const contentfs = require('../')
const through = require('through2')
const nocache = require('require-uncached')

test(`errors: hash mismatch`, async t => {
  t.plan(2)
  let createHasher = (cb) => {
    return through(() => setTimeout(() => cb(null, 'asdf'), 100))
  }
  let local = inmem()
  let remote = inmem(createHasher)
  let store = await contentfs.from(__dirname, local, remote)
  try {
    await store.push()
  } catch (e) {
    t.same(e.message, 'Remote hash does not match local hash.')
    t.type(e, 'Error')
  }
})

test(`errors: test browser exemptions`, t => {
  process.browser = true
  let _contentfs = nocache('../')
  t.plan(3)
  t.type(_contentfs, 'function')
  t.notok(_contentfs.walk)
  t.notok(_contentfs.from)
})

test(`errors: get invalid path`, async t => {
  t.plan(1)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.get('/not/there.txt')
  } catch (e) {
    t.type(e, 'Error')
  }
})

test(`errors: get before root is set`, async t => {
  t.plan(2)
  let store = contentfs(inmem(), inmem())
  try {
    await store.get('/testfile')
  } catch (e) {
    t.same(e.message, 'Root has not been set.')
    t.type(e, 'Error')
  }
})

test(`errors: get with dir reference`, async t => {
  t.plan(4)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.get(store._root)
  } catch (e) {
    t.same(e.message, `Not Found: ${store._root}`)
    t.type(e, 'Error')
  }

  try {
    await store.get('/')
  } catch (e) {
    t.same(e.message, `Not Found: /`)
    t.type(e, 'Error')
  }
})

test(`errors: ls a file`, async t => {
  t.plan(2)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.ls('/lib.js')
  } catch (e) {
    t.same(e.message, `Not Directory.`)
    t.type(e, 'Error')
  }
})

test(`errors: setRoot(hash) w/ no .dir`, async t => {
  t.plan(2)
  let store = contentfs(inmem(), inmem())
  try {
    await store.setRoot('asdf')
  } catch (e) {
    t.same(e.message, 'Cannot set root to non-directory.')
    t.type(e, 'Error')
  }
})

test(`errors: set() path that doesn't start with /`, async t => {
  t.plan(2)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.set('test.txt', Buffer.from('asdf'))
  } catch (e) {
    t.same(e.message, `Path is not valid.`)
    t.type(e, 'Error')
  }
})

test(`errors: inconsistent hashing`, async t => {
  let failStore = inmem(async () => 'asdf')
  let remote = inmem()
  let hash = await remote.set(Buffer.from('asdf'))
  t.plan(2)
  let store = await contentfs(failStore, remote)
  try {
    await store.__get(hash)
  } catch (e) {
    t.type(e, 'Error')
    t.same(e.message, 'local and remote do not consistently hash.')
  }
})
