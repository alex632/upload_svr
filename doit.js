//'use strict';	// Whole-script strict mode applied.

const http = require('http');
//import http from 'http';
const url = require('url');
//import url from 'url';
//const querystring = require('querystring');
const fs = require('fs');
//import path from 'path';
const path = require('path');

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
				console.log(`If-Modified-Since='${ifmds}' < '${stats.mtime.toUTCString()}'`);	//DEBUG
			}
			if ( !ifmds || stats.mtime-stats.mtime%1000 > new Date(ifmds).getTime() ) {
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
        handlePost(req, res);
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

//import {Buffer} from 'buffer';
//import { Buffer } from 'buffer';

function handleMtpfd0(bf, bdr/*, req, res*/) {
    let x1 = 0;
    let x2 = 0;
    function get1Line() {
        x2 = bf.indexOf('\r\n', x1);
        if (x2===-1) throw 'shit';
        let line = bf.slice(x1, x2);
        x1 = x2+2;
        return line;
    }
    //x2 = bf.indexOf('\r\n');
    //if (x2===-1) return -1;
    //let line = bf.slice(x1, x2);
    let line = get1Line();
    console.log(`line 1 ${line}`);
    if ( line.toString() !== `--${bdr}` ) return -2;
    //x1 = x2+2;
    //x2 = bf.indexOf('\r\n', x1);
    //line = bf.slice(x1, x2);
    line = get1Line();
    console.log(`line 2 ${line}`);
    if ( line.compare(Buffer.from('Content-Disposition: form-data; name="name"')) !== 0 ) return -3;
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    console.log(`line 3 ${line}`);
    if ( line.compare(Buffer.from('')) !== 0 ) return -4;
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    let fn = line.toString();
    console.log(`line 4 filename: '${line}'`);
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    console.log(`line 5: ${line}`);
    if ( line.indexOf(bdr) !== 2 ) return -5;
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    console.log(`line 6: ${line}`);
    // Content-Disposition: form-data; name="chunk"
    if ( line.compare(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fn}"`)) !== 0 ) return -6;
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    console.log(`line 7: ${line}`);
    const rex = new RegExp('Content-Type: (.*)');
    const m = rex.exec(line.toString());
    if (!m) return -7;
    let ct = m[1];
    x1 = x2+2;
    x2 = bf.indexOf('\r\n', x1);
    line = bf.slice(x1, x2);
    console.log(`line 8 ${line}`);
    if ( line.compare(Buffer.from('')) !== 0 ) return -8;
    x1 = x2+2;  // data begin
    const eof = Buffer.from(`\r\n--${bdr}--\r\n`);
    x2 = bf.indexOf(eof, x1);
    if ( x2 === -1 ) return -9;
    const flen = x2 - x1;
    console.log(`The post file ${fn} type ${ct} size ${flen}`);
    return 0;

}

function decodeHtmlEntities(encodedString) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = {
        "nbsp": " ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}

function handleMtpfd(bf, bdr/*, req, res*/) {
    let b = { file:[] };
    let x1 = 0, x2 = 0;
    function get1Line() {
        x2 = bf.indexOf('\r\n', x1);
        if (x2===-1) throw 'shit';
        let line = bf.slice(x1, x2);
        x1 = x2 + 2;
        return line;
    }
    const sep = Buffer.from(`--${bdr}`);
    const eob = Buffer.from(`--${bdr}--`);
    const emp = Buffer.from('');
    while (true) {
        let line = get1Line();
        if ( Buffer.compare(line, eob) === 0 ) {
            if ( x1 !== bf.length ) throw "something behind end of body";
            break;
        }
        if ( Buffer.compare(line, sep) === 0 ) {
            line = get1Line();
            const mf = /Content-Disposition: form-data; name="(.*?)"; filename="(.*?)"/.exec(line);
            if ( mf ) {
                line = get1Line();
                const mt = /Content-Type: (.*)/.exec(line);
                if ( !mt ) throw "No Content-Type";
                line = get1Line();
                if ( Buffer.compare(line, emp) !== 0 ) throw 'Not empty line before file contents';
                const eof = Buffer.from(`\r\n--${bdr}`);
                x2 = bf.indexOf(eof, x1);
                if (x2===-1) throw 'end of file not found';
                let fn = decodeHtmlEntities(mf[2]);
                b.file.push({name: mf[1], fn: fn, mime: mt[1], start: x1, end: x2});
                let fo = fs.createWriteStream(`./upload/${fn}`);
                fo.end(bf.slice(x1, x2));
                // TODO: chunk chunks by Plupload.
                x1 = x2 + 2;
            } else {
                const mh = /Content-Disposition: form-data; name="(.*?)"/.exec(line);
                if ( !mh ) throw "illegal form data";
                line = get1Line();
                if ( Buffer.compare(line, emp) !== 0 ) throw 'Not empty line';
                line = get1Line();
                b[mh[1]] = line.toString();    
            }
        }
    }
    return b;
}

function handlePost(req, res) {  // req: http.IncomingMessage, res: http.ServerResponse
    //console.log("POST me");
    //console.log(req.headers);
    let chunks = [];
    req.on('data', (chunk) => {
        chunks.push(chunk);
        //console.log(`Received ${chunk.length} bytes of data.`);
    });
    req.on('end', ()=>{
        let buff = Buffer.concat(chunks);
        //console.log(buff.toString());
        const ct = req.headers['content-type'];
        let bdr = '';
        if (ct) {
            const rex = new RegExp('multipart/form-data; boundary=(.*)');
            const m = rex.exec(ct);
            if (m) {
                bdr = m[1];
                console.log(bdr);
                const rv = handleMtpfd(buff, bdr);
                console.log(rv);
            }
        }
        let msg = `You have written ${buff.length} bytes`;
        //msg = '{"jsonrpc" : "2.0", "result" : null, "id" : "id"}';
        res.writeHead(200, {'Content-Type': 'text/html', 'Content-Length': msg.length});
        res.end(msg);
    });
}