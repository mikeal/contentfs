const promisify = require('util').promisify

const clean = hash => {
  let i = hash.indexOf('.')
  if (i === -1) return hash
  return hash.slice(0, i)
}

class AbstractContentFS {
  constructor (local, remote, opts) {
    this.local = local
    this.remote = remote
    this.opts = opts || {}
  }
  async _getRoot (store) {
    let _root = await this.getRoot()
    if (!_root) throw new Error('Root has not been set.')
    return this.__get(_root)
  }
  async __get (hash) {
    let value
    try {
      value = await this.local.get(clean(hash))
    } catch (e) {
      value = await this.remote.get(clean(hash))
    }
    if (hash.endsWith('.dir')) {
      value = JSON.parse(value.toString())
    }
    return value
  }
  async _get (path) {
    let root = await this._getRoot()
    let paths = path.split('/').filter(x => x)
    let _value = root
    while (paths.length) {
      let p = paths.shift()
      if (!_value[p]) throw new Error('Not found.')
      _value = await this.__get(_value[p])
    }
    return _value
  }
  async get (path) {
    let value
    if (path[0] === '/') {
      value = await this._get(path)
    } else {
      value = await this.__get(path)
    }
    if (Buffer.isBuffer(value)) return value
    throw new Error(`Not Found: ${path}`)
  }
  async _ls (path) {
    let value = await this._get(path)
    if (Buffer.isBuffer(value)) throw new Error('Not Directory.')
    return value
  }
  async ls (path, opts = {}) {
    let value = await this._ls(path)
    if (opts.raw) return value
    return Object.keys(value)
  }
  async _set (key, value, dir) {
    if (!key.startsWith('/')) throw new Error('Path is not valid.')
    let hash = await this.local.set(value)

    if (!dir) {
      let _root = await this.getRoot()
      if (_root) dir = await this.__get(_root)
      else dir = {}
    }

    let path = key.split('/').filter(x => x)
    let _dir = dir
    while (path.length) {
      let p = path.shift()
      if (!path.length) {
        _dir[p] = hash
        return dir
      }
      let value = _dir[p]
      if (typeof value === 'object') {
        _dir = value
      } else if (typeof value === 'string') {
        if (value.endsWith('.dir')) {
          _dir[p] = await this.__get(value)
        } else {
          // This was a file and is being overwritten as a directory.
          _dir[p] = {}
        }
        _dir = _dir[p]
      // Once we hit this point it is never false so we need to ignore
      // coverage of the falsey branch of the if.
      } /* istanbul ignore next */ else if (typeof value === 'undefined') {
        _dir[p] = {}
        _dir = _dir[p]
      } else {
        // Guard against internal dir corruption, can't be tested */
        /* istanbul ignore next */
        throw new Error('Invalid type in dir tree.')
      }
    }
    // Guard against while loop internal error, can't be tested */
    /* istanbul ignore next */
    throw new Error('Loop logic error, interals issue: please log issue.')
  }
  async _hashDirectory (dir) {
    for (let key in dir) {
      if (typeof dir[key] === 'object') {
        dir[key] = await this._hashDirectory(dir[key])
      }
    }
    return await this.local.set(Buffer.from(JSON.stringify(dir))) + '.dir'
  }
  async set (key, value) {
    if (this._pending) {
      return this._queue(key, value)
    } else {
      return this.setMulti([[key, value]])
    }
  }
  async _queue (key, value) {
    let all
    if (!Array.isArray(key)) {
      all = [[key, value]]
    } else {
      all = key
    }
    let promises = Promise.all(all.map(tuple => {
      return new Promise(resolve => {
        tuple.push(resolve)
      })
    }))
    this._pending = this._pending.concat(all)
    return promises
  }
  _drain () {
    let all = this._pending
    this._pending = null
    if (all.length) this.setMulti(all)
  }
  async setMulti (all) {
    if (this._pending) {
      return this._queue(all)
    }
    this._pending = []
    let current = await this.getRoot()
    let dir = null
    let resolves = []
    while (all.length) {
      let [key, value, resolve] = all.shift()
      dir = await this._set(key, value, dir)
      if (resolve) resolves.push(resolve)
    }
    /* Can't find a timing attack to trigger this consistently
       in tests but it is a valid concurrency concern.
    */
    /* istanbul ignore if */
    if (await this.getRoot() !== current) {
      throw new Error('Conflict error, root updated concurrently')
    }
    let root = await this._hashDirectory(dir)
    await this.setRoot(root, current)
    resolves.forEach(resolve => resolve(root))
    process.nextTick(() => {
      this._drain()
    })
    return root
  }
  async _openTree (tree) {
    let dirs = []
    for (let key in tree) {
      let value = tree[key]
      if (value.endsWith('.dir')) {
        dirs.push(value)
        let [_tree, _dirs] = await this._openTree(await this.__get(value))
        tree[key] = _tree
        dirs = dirs.concat(_dirs)
      }
    }
    return [tree, dirs]
  }
  async activeHashes (_root) {
    let current = _root || await this.getRoot()
    let dir = current ? await this.__get(current) : {}
    let [tree, dirs] = await this._openTree(dir)
    // If the tree is updated while we parsed it recursively
    // try again until we don't have a transaction issue.
    /* Can't find a timing attack to trigger this consistently
       in tests but it is a valid concurrency concern.
    */
    /* istanbul ignore if */
    if (!_root && current !== await this.getRoot()) return this.activeHashes()
    let initial = dirs.concat(current ? [current] : []).map(hash => clean(hash))
    let hashes = new Set(initial)
    let addHashes = (t = tree) => {
      Object.values(t).forEach(value => {
        if (typeof value === 'string') hashes.add(value)
        else addHashes(value)
      })
    }
    addHashes()
    return [...hashes]
  }
  async push (root) {
    // TODO: smarter sync on push.
    // The current scheme parses the whole tree and pushes everything.
    // A smarter scheme would be to open the remote tree along with
    // the local tree and not extend through the tree where there are
    // no changes.
    let hashes = await this.activeHashes(root)

    if (this.remote.missing) {
      // Remote supports the missing API.
      hashes = await this.remote.missing(hashes)
    }
    for (let hash of hashes) {
      let value = await this.local.get(hash)
      let rhash = await this.remote.set(value)
      if (hash !== rhash) throw new Error('Remote hash does not match local hash.')
    }
    return hashes
  }
}

class InMemoryContentFS extends AbstractContentFS {
  async setRoot (root, oldroot) {
    if (!root.endsWith('.dir')) throw new Error('Cannot set root to non-directory.')
    if (await this.getRoot() !== oldroot) {
      throw new Error('Root does not match.')
    }
    this._root = root
    return this
  }
  async getRoot () {
    return this._root || null
  }
}

module.exports = (...args) => new InMemoryContentFS(...args)
module.exports.AbstractContentFS = AbstractContentFS

if (!process.browser) {
  const fs = require('fs')
  const path = require('path')
  const ls = promisify(fs.readdir)
  const stat = promisify(fs.stat)
  const readFile = promisify(fs.readFile)
  const walk = async (dir, local, filter) => {
    let files = await ls(dir)
    let map = {}
    for (let file of files) {
      let fullpath = path.join(dir, file)
      let passes = true
      if (filter) {
        passes = filter(fullpath)
        if (passes && passes.then) passes = await passes
      }
      if (passes) {
        let stats = await stat(path.join(dir, file))
        if (stats.isDirectory()) {
          map[file] = await walk(fullpath, local, filter)
        } else {
          map[file] = await local.set(await readFile(fullpath))
        }
      }
    }
    return await local.set(Buffer.from(JSON.stringify(map))) + '.dir'
  }

  module.exports.from = async (directory, local, remote, filter) => {
    let root = await walk(directory, local, filter)
    let store = new InMemoryContentFS(local, remote)
    await store.setRoot(root, null)
    return store
  }
  module.exports.walk = walk
}
