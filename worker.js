addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const upstreamBaseUrl = "https://code.dlang.org";
const version = 1;
const keyPrefix = "ng2-";
//const upstreamBaseUrl = "http://31.15.67.41";

async function storeKeyValue(key, content) {
  const data = {time: Date.now(), version: version, content: content}
  await KV_DUB_REGISTRY.put(keyPrefix + key, JSON.stringify(data));
}

async function getKeyValue(key) {
  const cacheResult = await KV_DUB_REGISTRY.get(keyPrefix + key);
  if (cacheResult === null)
    return null;
  return JSON.parse(cacheResult);
}

async function fetchWithTimeout(url, timeout = 5000) {
  let didTimeOut = false;
  return new Promise(function(resolve, reject) {
      const timer = setTimeout(function() {
          didTimeOut = true;
          reject(new Error('Request timed out'));
      }, timeout);
      
      fetch(url)
        .then(function(response) {
            // Clear the timeout as cleanup
            clearTimeout(timer);
            if(!didTimeOut) {
                resolve(response);
            }
        })
        .catch(function(err) {
            // Rejection already happened with setTimeout
            if(didTimeOut) return;
            clearTimeout(timer);
            // Reject with error
            reject(err);
        });
  })
}

async function fetchRawFromUpstreamOrCache(url, expires = 1000 * 60 * 5) {
    const cacheResult = await getKeyValue(url)
    if (cacheResult !== null && cacheResult.time + expires > Date.now())
      return cacheResult.content;
    try {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        if (cacheResult === null)
          throw new Error(response.statusText);
        await storeKeyValue(url, cacheResult.content); // restore to update timestamp
        return cacheResult.content;
      } else {
        const upstreamRawResult = await response.text();
        try {
          await storeKeyValue(url, upstreamRawResult);
        } catch (e) {}
        return upstreamRawResult;
      }
    } catch (ex) {
      console.log(ex);
        if (cacheResult === null)
          throw new Error("upstream timeout");
        await storeKeyValue(url, cacheResult.content); // restore to update timestamp
        return cacheResult.content;
    }
}

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    if (request.url.indexOf("/api/") !== -1) {
      const upstreamUrl = upstreamBaseUrl + url.pathname + url.search;
      const data = await fetchRawFromUpstreamOrCache(upstreamUrl);
      return new Response(data, {status: 200, headers:{"content-type":"application/json"}});
    }

    const parts = url.pathname.split('/');
    if (parts[1] === 'packages') {
     const packageName = parts[2];
     const version = parts[3].slice(0,-4);

      const infoUrl = `${upstreamBaseUrl}/api/packages/${packageName}/info`
      let package = JSON.parse(await fetchRawFromUpstreamOrCache(infoUrl))

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
