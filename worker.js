addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const packagePrefix = "package-";

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    if (url.pathname === "/api/packages/search") {
      const data = await KV_DUB_PACKAGES.get(packagePrefix + url.searchParams.get("q"));
      if (data === null)
        return new Response("[]",{headers:{"content-type":"application/json"}})
      const package = JSON.parse(data);
      const result = [{name: package.name, description: package.description, version: package.versions.slice(-1)[0].version}]
      return new Response(JSON.stringify(result),{headers:{"content-type":"application/json"}})
    }
    if (url.pathname.indexOf("/packages/") === 0) {
      const parts = url.pathname.split("/");
      if (parts.length == 4) {
        const packageName = parts[2];
        const version = parts[3].slice(0,-4);

        let package = JSON.parse(await KV_DUB_PACKAGES.get(packagePrefix + packageName))

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
    }
    if (url.pathname === "/api/packages/infos") {
      const rootPackage = JSON.parse(url.searchParams.get("packages"))[0];
      let result = {};
      let visited = {};
      
        function handleResult(package, data) {
          if (data === null) {
            result[package] = null;
          } else {
            result[package] = JSON.parse(data);
            return Promise.all(result[package].versions.map(addDependencies))
          }
          return Promise.resolve()
        }
        function scheduleWork(name) {
          let package = name.split(":")
          let basePackage = package[0];
          let subPackage = package[1];
          if (result[basePackage] !== undefined) {
            if (subPackage) {
              result[basePackage].versions.forEach(version => {
                if (version.subPackages) {
                  const matchingSubPackage = version.subPackages.find(p => p.name == subPackage);
                  if (matchingSubPackage)
                    return Promise.all(addDependencies(matchingSubPackage));
                }
              })
            }
            return Promise.resolve();
          }
          return KV_DUB_PACKAGES.get(packagePrefix + basePackage).then(data => handleResult(basePackage, data))
        }
        function addDependencies(version) {
          let work = [];
          function planWork(deps) {
            Object.keys(deps).forEach(dep => {
              let basePackage = dep.split(":")[0]
              if (visited[basePackage] === undefined) {
                visited[basePackage] = true;
                work.push(scheduleWork(dep))
              }
            })
          }
          if (version.dependencies) {
            planWork(version.dependencies)
          }
          if (version.configurations) {
            version.configurations.forEach(config => {
              if (config.dependencies) {
                planWork(config.dependencies);
              }
            })
          }
          return Promise.all(work);
        }
        await scheduleWork(rootPackage)
        return new Response(JSON.stringify(result),{headers:{"content-type":"application/json"}})
    }
   
  } catch (e) {
    if (e.message == "Not Found")
      return new Response("Not Found", {status: 404})
    if (e.message == 'Request timed out')
      return new Response("Upstream timeout", {status: 504})
      console.log(e);
    return new Response("Error: " + e, {status: 500})
  }
  return new Response("Unknown request", {status: 500})
}
