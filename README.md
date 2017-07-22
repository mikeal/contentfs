# contentfs (Content Addressable Filesystem)

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
