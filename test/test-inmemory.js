const inmem = require('lucass/inmemory')
const lib = require('./lib')
const contentfs = require('../')
const test = require('tap').test

lib.forEach(fn => {
  fn('inmemory', inmem, inmem)
})

test(`inmemory: root mismatch`, async t => {
  t.plan(2)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  let root = await store.set('/testfile.txt', Buffer.from('asdfasff'))
  try {
    await store.setRoot(root, 'asf')
  } catch (e) {
    t.same(e.message, 'Root does not match.')
    t.type(e, 'Error')
  }
})

test(`inmemory: root mismatch`, async t => {
  t.plan(1)
  let store = await contentfs.from(__dirname, inmem(), inmem())
  let buff = Buffer.from('setMulti-test')
  let p1 = store.setMulti([['/_deepTree/setmulti.txt', buff], ['/setmulti.txt', buff]])
  let p2 = store.setMulti([['/concurrent.txt', buff]])
  let p3 = store.setMulti([['/_deepTree/1.txt', buff], ['/_deepTree/2.txt', buff]])

  let b = Buffer.from('createdirs')
  let all = [['/one/two/three/four/five/six.txt', b],
              ['/one/two/three/four/five/seven.txt', b],
              ['/one/two/three/eight.txt', b]]
  let p4 = store.setMulti(all)
  let interval = setInterval(() => {
    store._root = 'asdf'
  }, 1)
  await Promise.all([p1, p2, p3, p4])
  clearInterval(interval)
  t.ok(true)
})
