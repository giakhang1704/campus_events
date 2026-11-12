"""Isolated Brevo-compatible test transport. Never sends external email."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, threading, uuid
lock = threading.Lock()
accepted, attempts = {}, {}
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,status,data):
        raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        with lock: self.reply(200,dict(accepted=accepted,attempts=attempts))
    def do_POST(self):
        if self.path!='/v3/smtp/email' or self.headers.get('api-key')!='i2-test-key':
            self.reply(401,dict(code='unauthorized'));return
        # Spring's streaming HTTP client uses chunked transfer encoding.
        if self.headers.get('Transfer-Encoding','').lower()=='chunked':
            raw=bytearray()
            while True:
                size=int(self.rfile.readline().split(b';',1)[0],16)
                if size==0:
                    while self.rfile.readline().strip(): pass
                    break
                raw.extend(self.rfile.read(size))
                self.rfile.read(2)
        else:
            raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
        body=json.loads(raw)
        key=self.headers.get('idempotencyKey','')
        try: uuid.UUID(key)
        except ValueError: self.reply(400,dict(code='missing_idempotency'));return
        with lock:
            attempts[key]=attempts.get(key,0)+1
            if key in accepted:
                self.reply(400,dict(code='duplicate_parameter'));return
            if '[retry]' in body['subject'] and attempts[key]==1:
                self.reply(503,dict(code='unavailable'));return
            if '[reject]' in body['subject']:
                self.reply(400,dict(code='invalid_parameter'));return
            if '[exhaust]' in body['subject']:
                self.reply(503,dict(code='unavailable'));return
            accepted[key]=body
            if '[uncertain]' in body['subject']:
                self.reply(500,dict(code='response_lost'));return
            self.reply(201,dict(messageId='<i2-'+key+'@test.local>'))
ThreadingHTTPServer(('0.0.0.0',9090),Handler).serve_forever()
