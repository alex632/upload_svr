'use strict';	// Whole-script strict mode applied.

const http = require('http');
const url = require('url');
//const querystring = require('querystring');
const fs = require('fs'), path = require('path');

function getDateTime() {
	return new Date().toLocaleString('en-US');
}

const mimeTypes = {
	"html": "text/html",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"png": "image/png",
	"gif": "image/gif",
	"js": "text/javascript",
	"json": "application/json",
	"css": "text/css",
	"ico": "image/x-icon",
	"svg": "image/svg+xml"
};

function serveStaticFile(req, pathnm, res) {
	let actp = path.join("root", pathnm);
	//console.log("serveStaticFile", pathnm)
	fs.stat(actp, (error, stats)=>{
		if (error) {
			let msg;
			if (error.code == 'ENOENT') {
				msg = `${pathnm} not found. Are you kidding me?`;
			} else {
				msg = 'Unknown Error';
			}
			res.writeHead(404, {'Content-Type': 'text/plain', 'Content-Length': msg.length});
			res.end(msg);
		} else {
			let ifmds = req.headers['if-modified-since'];
			if (ifmds){
				console.log("If-Modified-Since", ifmds, stats.mtime.toUTCString());	//DEBUG
			}
			if ( !ifmds || stats.mtime-stats.mtime%1000 > new Date(ifmds) ) {
				let ext = path.extname(actp).split(".")[1];
				let mimeType = mimeTypes[ext];
				if (!mimeType) {
					mimeType = "text/plain";
					//mimeType = "application/octet-stream";	// Results in download
				}
				res.writeHead(200, {'Content-Type': mimeType,
					'Content-Length': stats.size,
					'Last-Modified': stats.mtime.toUTCString()
				});
				console.log(actp, mimeType, stats.size, stats.mtime.toUTCString());
				fs.createReadStream(actp).pipe(res);
			} else {
				res.writeHead(304, "Not Modified");
				res.end();
				console.log("Don't bother.");	//DEBUG
			}
		}
	});
}

//
// URL format:
//   /dir/filename.ext
//   /?q=john+doe
//   /?q=--dumpcache
//
//const server = 
http.createServer(function (req, res) {
    console.log(`${req.method} ${req.url}`);
    if ( req.method === "POST" ) {
        //console.log("POST me");
        console.log(req.headers);
        let chunks = [];
        req.on('data', (chunk) => {
            chunks.push(chunk);
            console.log(`Received ${chunk.length} bytes of data.`);
        });
        req.on('end', ()=>{
            let buff = Buffer.concat(chunks);
            console.log(`[${buff.toString()}]`);
            let msg = `Got ${buff.byteLength} bytes`;
			//msg = '{"jsonrpc" : "2.0", "result" : null, "id" : "id"}';
            res.writeHead(200, {'Content-Type': 'text/html', 'Content-Length': msg.length});
			res.end(msg);
        });
    } else {
        let uri = url.parse(req.url, false);
        //console.log(req.headers);
        if (uri.pathname !== "/") {
            serveStaticFile(req, uri.pathname, res);
        } else {
            serveStaticFile(req, "index.html", res);	// Default page
        }
    }
}).listen(8964, function() {
	console.log(`${getDateTime()} HTTP Server is listening on port 8964`);
});
