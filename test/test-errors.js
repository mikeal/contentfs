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
    await store.get('/not/there.txt')
  } catch (e) {
    t.type(e, 'Error')
  }
})
