addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  if (request.url.indexOf("/api/") !== -1) {
    const redirectUrl = "https://code.dlang.org" + url.pathname + url.search;
    return Response.redirect(redirectUrl, 301);
  }

  const parts = url.pathname.split('/');
  if (parts[1] === 'packages') {
    const packageName = parts[2];
    const version = parts[3].slice(0,-4);

    const result = await fetch(`https://code.dlang.org/api/packages/${packageName}/info`);
    const package = await result.json();
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
  return new Response("Unknown request", {status: 400})
}
