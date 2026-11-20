#!/usr/bin/env python3
"""SPA server that routes all non-file requests to index.html"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # For SPA routing: if file doesn't exist, serve index.html
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            self.path = '/index.html'
        return SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__) + '/dist')
    server = HTTPServer(('localhost', 8000), SPAHandler)
    print('Serving at http://localhost:8000/')
    server.serve_forever()
