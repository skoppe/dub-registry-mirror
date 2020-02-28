# Dub registry mirror

This dub registry mirror is implemented as a cloudflare worker.

The dub packages are stored in the cloudflare KV-store.

The KV-store store is updated every 15 minutes by github.com/skoppe/dub-packages-indexer

## Use it

`dub --registry="https://dub.bytecraft.nl"`
