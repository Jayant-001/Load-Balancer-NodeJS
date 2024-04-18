const http = require("http");
const url = require('url')

const PORT = 5002;

const server = http.createServer((req, res) => {

  const urlPath = url.parse(req.url);

  if(urlPath.pathname === "/health") {
    res.writeHead(200);
    return res.end();
  }

  res.write("hello from server 2");
  res.end();
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
