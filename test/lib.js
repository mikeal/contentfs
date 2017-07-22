const test = require('tap').test
const contentfs = require('../')
const fs = require('fs')
const util = require('util')
const path = require('path')
const readFile = util.promisify(fs.readFile)

module.exports = []

module.exports.push((name, createLocal, createRemote) => {
  test(`${name}: basic init.`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let one = await store.getBuffer(f)
    let two = await readFile(__filename)
    t.deepEqual(one, two)
  })

  test(`${name}: basic set.`, async t => {
    t.plan(3)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let oldroot = store._root
    let newfile = Buffer.from('asdfasdf')
    let newroot = await store.set(f, newfile)
    t.deepEqual(await store.getBuffer(f), newfile)
    t.notEquals(oldroot, newroot)
    t.equals(newroot, store._root)
  })

  test(`${name}: transaction error updating root.`, async t => {
    t.plan(1)
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let f = `/${path.basename(__filename)}`
    let newfile = Buffer.from('asdfasdf')
    store.set(f, newfile)
    try {
      await store.set(f, newfile)
    } catch (e) {
      t.type(e, 'Error')
    }
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
    t.deepEquals([root.slice(0, root.indexOf('.')), filehash], hashes)
  })

  test(`${name}: get from remote`, async t => {
    t.plan(1)
    let remote = createRemote()
    let root = await contentfs.walk(__dirname, remote)
    let store = contentfs(createLocal(), remote)
    store.setRoot(root)
    let buffer = await store.getBuffer(`/${path.basename(__filename)}`)
    let compare = await util.promisify(fs.readFile)(__filename)
    t.deepEqual(buffer, compare)
  })

  test(`${name}: push to remote`, async t => {
    let store = await contentfs.from(__dirname, createLocal(), createRemote())
    let pushed = await store.activeHashes()
    let [root, hashes] = await store.push()
    t.plan(pushed.length + 2)
    t.ok(root)
    t.deepEqual(pushed, hashes)
    for (let hash of pushed) {
      t.equal(await store._getLocal(hash), await store._getRemote(hash))
    }
  })
})
