# Dub cloudflare worker registry mirror

This cloudflare worker simply redirects, avoiding the parts of the dub registry that suffer from downtime.

It is a quick bandaid solution, but one with no downtime :)

## Use it

`dub build --registry=https://dub.bytecraft.nl`
