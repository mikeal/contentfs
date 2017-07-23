const inmem = require('lucass/inmemory')
const test = require('tap').test
const contentfs = require('../')
const nocache = require('require-uncached')

test(`errors: hash mismatch`, async t => {
  t.plan(1)
  let local = inmem()
  let remote = inmem('sha1')
  let store = await contentfs.from(__dirname, local, remote)
  try {
    await store.push()
  } catch (e) {
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
    await store.getBuffer('/not/there.txt')
  } catch (e) {
    t.type(e, 'Error')
  }
})

test(`errors: get before root is set`, async t => {
  t.plan(2)
  let store = contentfs(inmem(), inmem())
  try {
    await store.getBuffer('/testfile')
  } catch (e) {
    t.same(e.message, 'Root has not been set.')
    t.type(e, 'Error')
  }
})

test(`errors: invalid prop promise`, async t => {
  t.plan(2)
  try {
    contentfs._propromise({}, 'asdf')
  } catch (e) {
    t.same(e.message, `Missing property: asdf`)
    t.type(e, 'Error')
  }
})

test(`errors: getBuffer with dir reference`, async t => {
  t.plan(4)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.getBuffer(store._root)
  } catch (e) {
    t.same(e.message, `Not Found: ${store._root}`)
    t.type(e, 'Error')
  }

  try {
    await store.getBuffer('/')
  } catch (e) {
    t.same(e.message, `Not Found: /`)
    t.type(e, 'Error')
  }
})

test(`errors: ls a file`, async t => {
  t.plan(2)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  try {
    await store.ls('/test.txt')
  } catch (e) {
    t.same(e.message, `Not found.`)
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
