# contentfs (Content Addressable Filesystem)

[![Coverage Status](https://coveralls.io/repos/github/mikeal/contentfs/badge.svg?branch=master)](https://coveralls.io/github/mikeal/contentfs?branch=master)
[![Build Status](https://travis-ci.org/mikeal/contentfs.svg?branch=master)](https://travis-ci.org/mikeal/contentfs)
[![dependencies Status](https://david-dm.org/mikeal/contentfs/status.svg)](https://david-dm.org/mikeal/contentfs)

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A filesystem is a tree of names that correspond to points of data.

Content addressablility is when content is referred to by a consistent
hash of the content rather than a human readable name.

`contenfs` is a content addressable filesystem. It stores a map of names
to content addresses. This meta info is itself stored in a content addressable
manor as well. This means that every "directory" has a hash that will change
whenever any of the content in the tree is changed.

This structure is very useful for syncing representations of filesystems and other
similar human readable structures and syncing them around. It is **not** very useful
for syncing and merging changes inside of individual files.

`contentfs` builds on top of [`lucass`](https://github.com/mikeal/lucass), an
abstraction for content addressable storage. This allows `contentfs` to easily
map on top of all sorts of underlying storage systems (inmemory, fs, S3, IndexDB,
blockchain, etc). The only catch is that the hashing system must be consistent
between the two implementations (many implementations allow their hashing to be
configured).

```javascript
let inmem = require('lucass/inmemory')
let localstore = inmem()
let remotestore = inmem()
let store = await contentfs.from(__dirname, localstore, remotestore)
let rootNode = await store.set('/filename.txt', Buffer.from('asdf'))
// local store has its tree updated and content stored, remote does not.
let hashes = await store.push()
// remote was pushed `hashes`
```
