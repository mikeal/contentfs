const promisify = require('util').promisify

const isDirParsed = dirMap => {
  for (let key of dirMap.keys()) {
    let value = dirMap.get(key)
    if (typeof value === 'string' && value.endsWith('.dir')) {
      return false
    } else if (typeof value === 'object') {
      if (!isDirParsed(value)) return false
    } else if (typeof value !== 'string') {
      throw new Error('Directory contains unknown types.')
    }
  }
}

const propPromise = (inst, prop) => {
  if (!inst[prop]) throw new Error(`Missing property: ${prop}`)
  return promisify((...args) => inst[prop](...args))
}

const clean = hash => {
  let i = hash.indexOf('.')
  if (i === -1) return hash
  return hash.slice(0, i)
}

class ContentFS {
  constructor (local, remote, opts) {
    this.local = local
    this.remote = remote
    this.opts = opts || {}
    this._getLocal = propPromise(this.local, 'getBuffer')
    this._setLocal = propPromise(this.local, 'set')
    this._getRemote = propPromise(this.remote, 'getBuffer')
    this._setRemote = propPromise(this.remote, 'set')
    this._root = null
  }
  async _getRoot (store) {
    if (!this._root) throw new Error('Root has not been set.')
    return await this.__get(this._root)
  }
  async __get (hash) {
    let value
    try {
      value = await this._getLocal(clean(hash))
    } catch (e) {
      value = await this._getRemote(clean(hash))
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
  async getBuffer (path) {
    let value
    if (path[0] === '/') {
      value = await this._get(path)
    } else {
      value = await this.__get(path)
    }
    if (Buffer.isBuffer(value)) return value
    throw new Error('Not Found')
  }
  async _ls (path) {
    let value = await this._get(path)
    if (Buffer.isBuffer(value)) throw new Error('Not Directory.')
    return value
  }
  async ls (path) {
    let value = this._ls(path)
    return Object.keys(value)
  }
  setRoot (root) {
    if (!root.endsWith('.dir')) throw new Error('Cannot set root to non-directory.')
    this._root = root
    return this
  }
  async _set (key, value, dir = null) {
    if (!key.startsWith('/')) throw new Error('Path is not valid.')
    let hash = await this._setLocal(value)
    if (!dir) dir = await this.__get(this._root)
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
          _dir = _dir[p]
        }
      }
    }
    return dir
  }
  async _hashDirectory (dir) {
    for (let key in dir) {
      if (typeof dir[key] === 'object') {
        dir[key] = await this._hashDirectory(dir[key])
      }
    }
    return await this._setLocal(Buffer.from(JSON.stringify(dir))) + '.dir'
  }
  async set (key, value) {
    let current = this._root
    let dir = await this._set(key, value)
    let root = await this._hashDirectory(dir)
    if (this._root !== current) throw new Error('Conflict error, root updated concurrently')
    this.setRoot(root)
    return root
  }
  async _openTree (tree) {
    let dirs = []
    for (let key in tree) {
      let value = tree[key]
      if (value.endsWith('.dir')) {
        dirs.push(value)
        let [tree, _dirs] = await this._openTree(this.__get(value))
        tree[key] = tree
        dirs = dirs.concat(_dirs)
      }
    }
    return [tree, dirs]
  }
  async activeHashes () {
    let current = this._root
    let dir = await this.__get(current)
    let [tree, dirs] = await this._openTree(dir)
    // If the tree is updated while we parsed it recursively
    // try again until we don't have a transaction issue.
    if (current !== this._root) return this.activeHashes()
    let initial = dirs.concat(current).map(hash => clean(hash))
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
  async push (useBuffers = true) {
    let root = this._root
    let hashes = await this.activeHashes()
    for (let hash of hashes) {
      let value = await this.getBuffer(hash)
      let rhash = await this._setRemote(value)
      if (hash !== rhash) throw new Error('Remote hash does not match local hash.')
    }
    return [root, hashes]
  }
}

module.exports = (local, remote, opts) => new ContentFS(local, remote, opts)

if (!process.browser) {
  const fs = require('fs')
  const path = require('path')
  const ls = promisify(fs.readdir)
  const stat = promisify(fs.stat)
  const readFile = promisify(fs.readFile)
  const walk = async (dir, local) => {
    let set = propPromise(local, 'set')
    let files = await ls(dir)
    let map = {}
    for (let file of files) {
      let fullpath = path.join(dir, file)
      let stats = await stat(path.join(dir, file))
      if (stats.isDirectory()) {
        map[file] = await walk(fullpath, local)
      } else {
        map[file] = await set(await readFile(fullpath))
      }
    }
    return await set(Buffer.from(JSON.stringify(map))) + '.dir'
  }

  module.exports.from = async (directory, local, remote) => {
    let root = await walk(directory, local)
    return module.exports(local, remote).setRoot(root)
  }
  module.exports.walk = walk
}
