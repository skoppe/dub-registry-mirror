addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function fetchWithCache(url) {
    let result = await KV_DUB_REGISTRY.get(url)
    if (result !== null)
        return JSON.parse(result);

    const response = await fetch(url);
    if (!response.ok)
        return response;

    const data = await response.json();
    await KV_DUB_REGISTRY.put(url, JSON.stringify(data));
    return data;
}

async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        if (request.url.indexOf("/api/") !== -1) {
            const redirectUrl = "https://code.dlang.org" + url.pathname + url.search;
            return Response.redirect(redirectUrl, 302);
        }

        const parts = url.pathname.split('/');
        if (parts[1] === 'packages') {
            const packageName = parts[2];
            const version = parts[3].slice(0,-4);
            const infoUrl = `https://code.dlang.org/api/packages/${packageName}/info`

            let package = fetchWithCache(infoUrl);
            const repo = package.repository;
            const repoType = repo.kind;

            switch (repoType) {
            case 'github':
                return Response.redirect(`https://github.com/${repo.owner}/${repo.project}/archive/v${version}.zip`, 301)
            case 'gitlab':
                return Response.redirect(`https://gitlab.com/${repo.owner}/${repo.project}/-/archive/v${version}/${repo.project}-v${version}.zip`, 301)
            default:
                return new Response(`Repository ${repoType} is not supported`,{status: 400})
            }
        }
    } catch (e) {
        return new Response("Error: " + e.message, {status: 400})
    }
    return new Response("Unknown request", {status: 500})
}
