"""Local Wi-Fi preview; internet connection not required. Ctrl-C stops."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse,functools,webbrowser
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8773);p.add_argument('--local',action='store_true');p.add_argument('--open',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1]
print(f'Mac: http://localhost:{a.port}/',flush=True)
print(f'iPad: http://<Macin Wi-Fi-IP>:{a.port}/ — sama paikallisverkko, Macin on pysyttävä päällä.',flush=True)
server=ThreadingHTTPServer(('127.0.0.1' if a.local else '0.0.0.0',a.port),functools.partial(SimpleHTTPRequestHandler,directory=str(root)))
if a.open:webbrowser.open(f'http://localhost:{a.port}/')
server.serve_forever()
