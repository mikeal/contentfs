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
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let one = await store.getBuffer(f)
    let two = await readFile(__filename)
    t.same(one, two)
  })

  test(`${name}: basic hash get`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buffer = await store.getBuffer(store._root.slice(0, store._root.indexOf('.')))
    let obj = await store.__get(store._root)
    t.same(obj, JSON.parse(buffer.toString()))
  })

  test(`${name}: basic set.`, async t => {
    t.plan(3)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let oldroot = store._root
    let newfile = Buffer.from('asdfasdf')
    let newroot = await store.set(f, newfile)
    t.same(await store.getBuffer(f), newfile)
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
    let set = util.promisify((value, cb) => local.set(value, cb))
    let oldroot = await set(Buffer.from('{}'))
    store.setRoot(oldroot + '.dir')
    let file = Buffer.from('asdf')
    let filehash = await set(file)
    let root = await store.set('/testfile', file)
    let hashes = await store.activeHashes()
    t.same([root.slice(0, root.indexOf('.')), filehash], hashes)
  })

  test(`${name}: get from remote`, async t => {
    t.plan(1)
    let remote = createRemote()
    let root = await contentfs.walk(__dirname, remote)
    let store = contentfs(createLocal(), remote)
    store.setRoot(root)
    let buffer = await store.getBuffer(`/${path.basename(__filename)}`)
    let compare = await util.promisify(fs.readFile)(__filename)
    t.same(buffer, compare)
  })

  test(`${name}: push to remote`, async t => {
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let expected = await store.activeHashes()
    let [root, hashes] = await store.push()
    t.plan(expected.length + 2)
    t.ok(root)
    t.same(expected, hashes)
    for (let hash of expected) {
      t.same(await store._getLocal(hash), await store._getRemote(hash))
    }
  })

  test(`${name}: deep get`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buffer = await store.getBuffer('/_deepTree/_1/_2/test.txt')
    t.same(buffer, Buffer.from('test'))
  })

  test(`${name}: deep set`, async t => {
    t.plan(6)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let original = new Set(await store.activeHashes())
    await store.set('/_deepTree/test.txt', Buffer.from('new-text'))
    let buffer = await store.getBuffer('/_deepTree/test.txt')
    t.same(buffer, Buffer.from('new-text'))
    let overwritten = new Set(await store.activeHashes())
    t.same(diff(original, overwritten).size, 2)
    await store.set('/_deepTree/_1/_2/3/4/test.text', Buffer.from('new-text'))
    t.same(await store.getBuffer('/_deepTree/_1/_2/3/4/test.text'), buffer)
    let deepwrite = new Set(await store.activeHashes())
    t.same(diff(overwritten, deepwrite).size, 4)
    t.same(await store.ls('/_deepTree/_1/_2/3'), ['4'])
    t.same(await store.ls('/_deepTree/_1/_2/3/4'), ['test.text'])
    // TODO: overwrite a directory with a file.
  })

  test(`${name}: setMulti()`, async t => {
    t.plan(5)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buff = Buffer.from('setMulti-test')
    let p1 = store.setMulti([['/_deepTree/setmulti.txt', buff], ['/setmulti.txt', buff]])
    let p2 = store.setMulti([['/concurrent.txt', buff]])
    await p1
    t.same(await store.getBuffer('/_deepTree/setmulti.txt'), buff)
    t.same(await store.getBuffer('/setmulti.txt'), buff)
    await p2
    t.same(await store.getBuffer('/concurrent.txt'), buff)
    await store.setMulti([['/_deepTree/1.txt', buff], ['/_deepTree/2.txt', buff]])
    t.same(await store.getBuffer('/_deepTree/1.txt'), buff)
    t.same(await store.getBuffer('/_deepTree/2.txt'), buff)
  })

  test(`${name}: overwrite file as dir`, async t => {
    t.plan(4)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let buff = Buffer.from('overwrite')
    await store.set('/test-fs.js/overwrite.txt', buff)
    t.same(await store.getBuffer('/test-fs.js/overwrite.txt'), buff)
    t.same(await store.ls('/test-fs.js/'), ['overwrite.txt'])
    try {
      await store.getBuffer('/test-fs.js')
    } catch (e) {
      t.same(e.message, 'Not Found: /test-fs.js')
      t.type(e, 'Error')
    }
  })
})
