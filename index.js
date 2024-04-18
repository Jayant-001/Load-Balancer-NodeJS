const http = require("http");
const httpProxy = require("http-proxy");
const url = require("url");

const PORT = 5000;
const servers = [
    {
        name: "Server 1",
        host: "localhost",
        port: 5001,
        alive: true,
        requests: 0,
    },
    {
        name: "Server 2",
        host: "localhost",
        port: 5002,
        alive: true,
        requests: 0,
    },
    {
        name: "Server 3",
        host: "localhost",
        port: 5003,
        alive: true,
        requests: 0,
    },
    {
        name: "Server 4",
        host: "localhost",
        port: 5004,
        alive: true,
        requests: 0,
    },
];

// Rate limiter contants
const rateLimitWindowMS = 60000; // 1 minute window
const rateLimitNumRequests = 10; // Limit each IP to 10 requests per window
const requestTimestamps = new Map(); // Store timestamp records of each request per IP

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    const urlPath = url.parse(req.url);

    const ip = req.socket.remoteAddress;
    const currentTime = Date.now();

    if (!requestTimestamps.has(ip)) {
        requestTimestamps.set(ip, []);
    }

    const timeStamps = requestTimestamps.get(ip);
    // Remove timestamps older than our rateLimitWindowMS
    const recentTimestamps = timeStamps.filter(
        (timestamp) => currentTime - timestamp < rateLimitWindowMS
    );

	// recentTimestamps.push(currentTime);

    // Calculate the number of remaining requests
    const remainingRequests = rateLimitNumRequests - recentTimestamps.length;


    // Send rate limit headers with every response
    res.setHeader("X-RateLimit-Limit", rateLimitNumRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, remainingRequests)); // Don't send negative values


	// Calculate when the current rate limit window resets (in Unix epoch seconds)
    let resetTimestamp = currentTime;
    if (recentTimestamps.length !== 0) {
        resetTimestamp = recentTimestamps[0] + rateLimitWindowMS; // Earliest timestamp + window size
    }


	const resetTime = Math.ceil((resetTimestamp - currentTime) / 1000); // Convert to seconds
    res.setHeader('X-RateLimit-Reset', resetTime);

	
    if (remainingRequests < 0) {
        res.writeHead(429, { "Content-Type": "text/plain" });
        return res.end("Too many requests, Please try after sometime.");
    }

    recentTimestamps.push(currentTime);
    requestTimestamps.set(ip, recentTimestamps);

    if (urlPath.pathname === "/serverstatus")
        return serverStatus(req, res, servers);

    const aliveServers = servers.filter((server) => server.alive === true);

    const targetServer =
        aliveServers.length > 0
            ? aliveServers.reduce((prev, cur) =>
                  prev.requests < cur.requests ? prev : cur
              )
            : null;

    if (!targetServer) {
        res.writeHead(503, { "Content-Type": "text/plain" });
        return res.end("All servers are down");
    }

    targetServer.requests++;

    proxy.web(req, res, {
        target: `http://${targetServer.host}:${targetServer.port}`,
    });
});

const serverStatus = (req, res, servers) => {
    res.writeHead(200, { "Content-Type": "text/json" });
    return res.end(JSON.stringify(servers));
};

const healthCheck = (server) => {
    const option = {
        host: server.host,
        port: server.port,
        path: "/health",
        timeout: 2000, // Timeout after 2 seconds
    };

    http.get(option, (res) => {
        server.alive = res.statusCode === 200;
    }).on("error", () => (server.alive = false));
};

setInterval(() => {
    servers.forEach((server) => healthCheck(server));
}, 2000);


server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
