//'use strict';	// Whole-script strict mode applied.

const http = require('http');
//import http from 'http';
const url = require('url');
//import url from 'url';
const fs = require('fs');
const path = require('path');
//import path from 'path';

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

http.createServer(async function (req, res) {
    //console.log(`${req.method} ${req.url}`);
    if ( req.method === "POST" ) {
        handlePost(req, res);
    } else {
        let uri = url.parse(req.url, false);
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

var pending = {};

function saveFiles(bf, b) {
    if ( b.chunks && b.chunk ) {   // chunked transmission by Plupload
        if ( b.files.length !== 1 ) throw "Damn Plupload. Post multiple files with chunks not reasonable.";
        const f = b.files[0];
        const chunk = parseInt(b.chunk);
        const chunks = parseInt(b.chunks);
        if ( chunk === 0 ) {
            let otpFn;
            if ( chunks === 1 ) {
                otpFn = `./upload/${b.name}`;
            } else {
                otpFn = `./upload/${b.name}.pd!`;
            }
            let fo = fs.createWriteStream(otpFn);
            fo.write(bf.slice(f.start, f.end));
            if ( chunks === 1 ) {
                fo.end();
            } else {
                pending[f.fn] = {fo: fo, chunk: chunk, chunks: chunks, tmpFn: otpFn, fn: `./upload/${b.name}`};
            }
        } else {
            let pf = pending[f.fn];
            if ( !pf ) throw "weird 1";
            if ( chunks !== pf.chunks ) throw "weird 2";
            if ( chunk !== pf.chunk+1 ) throw "Wrong sequence";
            pf.fo.write(bf.slice(f.start, f.end));
            if ( chunk === chunks-1 ) {
                pf.fo.end(()=>{
                    console.log(`rename ${pf.tmpFn} to ${pf.fn}`);
                    fs.rename(pf.tmpFn, pf.fn, ()=>{});
                    delete pending[f.fn];
                });
            } else {
                pf.chunk = chunk;
            }
        }
    } else {    // Ordinary HTML post file
        b.files.forEach (f => {
            console.log(`Save ${f.fn} ${f.end-f.start} bytes`);
            let fo = fs.createWriteStream(`./upload/${f.fn}`);
            fo.end(bf.slice(f.start, f.end));
        });
    }
}

/**
 * Handle multipart/form-data POST request
 * @param {*} bf POST body as Buffer
 * @param {*} bdr boundary
 * @returns object
 * @throws error message as string
 */
async function handleMtpfd(bf, bdr) {
    let b = { files:[] };
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
                b.files.push({name: mf[1], fn: fn, mime: mt[1], start: x1, end: x2});
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
    if ( b.files.length ) saveFiles(bf, b);
    return b;
}

function handlePost(req, res) {  // req: http.IncomingMessage, res: http.ServerResponse
    let chunks = [];
    req.on('data', (chunk) => {
        chunks.push(chunk);
    });
    req.on('end', async ()=>{
        let buff = Buffer.concat(chunks);
        let stCode = 200;
        let msg = `Got ${buff.length} bytes`;
        const ct = req.headers['content-type'];
        if (ct) {
            const rex = new RegExp('multipart/form-data; boundary=(.*)');
            const m = rex.exec(ct);
            if (m) {
                let bdr = m[1];
                try {
                    const rv = await handleMtpfd(buff, bdr);
                    console.log(rv);
                } catch (e) {
                    console.log(e);
                    stCode = 400;   // Bad Request
                    msg = e;
                }
            }
        }
        res.writeHead(stCode, {'Content-Type': 'text/html', 'Content-Length': msg.length});
        res.end(msg);
    });
}
