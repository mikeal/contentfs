const test = require('tap').test
const contentfs = require('../')
const fs = require('fs')
const util = require('util')
const path = require('path')
const readFile = util.promisify(fs.readFile)

module.exports = []

const diff = (a, b) => {
  return new Set([...a].filter(x => !b.has(x)))
}

module.exports.push((name, createLocal, createRemote) => {
  test(`${name}: basic init.`, async t => {
    t.plan(1)
    let local = createLocal()
    let store = await contentfs.from(__dirname, local, createRemote())
    let f = `/${path.basename(__filename)}`
    let one = await store.get(f)
    let two = await readFile(__filename)
    t.same(one, two)
  })

  test(`${name}: basic hash get`, async t => {
    t.plan(1)

    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let _root = await store.getRoot()
    let buffer = await store.get(_root.slice(0, _root.indexOf('.')))
    let obj = await store.__get(await store.getRoot())
    t.same(obj, JSON.parse(buffer.toString()))
  })

  test(`${name}: basic set.`, async t => {
    t.plan(3)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let oldroot = await store.getRoot()
    let newfile = Buffer.from('asdfasdf')
    let newroot = await store.set(f, newfile)
    t.same(await store.get(f), newfile)
    t.notsame(oldroot, newroot)
    t.equals(newroot, store._root)
  })

  test(`${name}: basic ls.`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let files = await store.ls('/_deepTree')
    t.same([ '_1', 'test.txt' ], files)
  })

  test(`${name}: active hashes.`, async t => {
    t.plan(1)
    let local = createLocal()
    let store = contentfs(local, createRemote())
    let oldroot = await local.set(Buffer.from('{}'))
    await store.setRoot(oldroot + '.dir', null)
    let file = Buffer.from('asdf')
    let filehash = await local.set(file)
    let root = await store.set('/testfile', file)
    let hashes = await store.activeHashes()
    t.same([root.slice(0, root.indexOf('.')), filehash], hashes)
  })

  test(`${name}: get from remote`, async t => {
    t.plan(1)
    let remote = createRemote()
    let root = await contentfs.walk(__dirname, remote)
    let store = contentfs(createLocal(), remote)
    await store.setRoot(root, null)
    let buffer = await store.get(`/${path.basename(__filename)}`)
    let compare = await util.promisify(fs.readFile)(__filename)
    t.same(buffer, compare)
  })

  test(`${name}: push to remote`, async t => {
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let expected = await store.activeHashes()
    let root = await store.getRoot()
    let hashes = await store.push()
    t.plan(expected.length + 2)
    t.ok(root)
    t.same(expected, hashes)
    for (let hash of expected) {
      t.same(await store.local.get(hash), await store.remote.get(hash))
    }
  })

  test(`${name}: deep get`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buffer = await store.get('/_deepTree/_1/_2/test.txt')
    t.same(buffer, Buffer.from('test'))
  })

  test(`${name}: deep set`, async t => {
    t.plan(7)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let original = new Set(await store.activeHashes())
    await store.set('/_deepTree/test.txt', Buffer.from('new-text'))
    let buffer = await store.get('/_deepTree/test.txt')
    t.same(buffer, Buffer.from('new-text'))
    let overwritten = new Set(await store.activeHashes())
    t.same(diff(original, overwritten).size, 2)
    await store.set('/_deepTree/_1/_2/3/4/test.text', Buffer.from('new-text'))
    t.same(await store.get('/_deepTree/_1/_2/3/4/test.text'), buffer)
    let deepwrite = new Set(await store.activeHashes())
    t.same(diff(overwritten, deepwrite).size, 4)
    t.same(await store.ls('/_deepTree/_1/_2/3'), ['4'])
    t.same(await store.ls('/_deepTree/_1/_2/3/4'), ['test.text'])

    let b = Buffer.from('createdirs')
    await store.set('/one/two/three/four/five/six.txt', b)
    t.same(await store.get('/one/two/three/four/five/six.txt'), b)
  })

  test(`${name}: setMulti()`, async t => {
    t.plan(8)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buff = Buffer.from('setMulti-test')
    let p1 = store.setMulti([['/_deepTree/setmulti.txt', buff], ['/setmulti.txt', buff]])
    let p2 = store.setMulti([['/concurrent.txt', buff]])
    await p1
    t.same(await store.get('/_deepTree/setmulti.txt'), buff)
    t.same(await store.get('/setmulti.txt'), buff)
    await p2
    t.same(await store.get('/concurrent.txt'), buff)
    await store.setMulti([['/_deepTree/1.txt', buff], ['/_deepTree/2.txt', buff]])
    t.same(await store.get('/_deepTree/1.txt'), buff)
    t.same(await store.get('/_deepTree/2.txt'), buff)

    let b = Buffer.from('createdirs')
    let all = [['/one/two/three/four/five/six.txt', b],
               ['/one/two/three/four/five/seven.txt', b],
               ['/one/two/three/eight.txt', b]]
    await store.setMulti(all)
    t.same(await store.get('/one/two/three/four/five/six.txt'), b)
    t.same(await store.get('/one/two/three/four/five/seven.txt'), b)
    t.same(await store.get('/one/two/three/eight.txt'), b)
  })

  test(`${name}: overwrite file as dir`, async t => {
    t.plan(4)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buff = Buffer.from('overwrite')
    await store.set('/test-fs.js/overwrite.txt', buff)
    t.same(await store.get('/test-fs.js/overwrite.txt'), buff)
    t.same(await store.ls('/test-fs.js/'), ['overwrite.txt'])
    try {
      await store.get('/test-fs.js')
    } catch (e) {
      t.same(e.message, 'Not Found: /test-fs.js')
      t.type(e, 'Error')
    }
  })
})
