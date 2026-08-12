# golang.org/x/sync/singleflight — package docs

- Source URL: https://pkg.go.dev/golang.org/x/sync/singleflight
- Accessed: 2026-08-12
- Note: content extracted via WebFetch; doc comments quoted exactly.

Package singleflight provides a duplicate function call suppression mechanism. `Group` represents a class of work and forms a namespace in which units of work can be executed with duplicate suppression.

```go
func (g *Group) Do(key string, fn func() (any, error)) (v any, err error, shared bool)
```

> Do executes and returns the results of the given function, making sure that only one execution is in-flight for a given key at a time. If a duplicate comes in, the duplicate caller waits for the original to complete and receives the same results. The return value shared indicates whether v was given to multiple callers.

```go
func (g *Group) DoChan(key string, fn func() (any, error)) <-chan Result
```

> DoChan is like Do but returns a channel that will receive the results when they are ready. The returned channel will not be closed.

```go
func (g *Group) Forget(key string)
```

> Forget tells the singleflight to forget about a key. Future calls to Do for this key will call the function rather than waiting for an earlier call to complete.

```go
type Result struct {
	Val    any
	Err    error
	Shared bool
}
```
