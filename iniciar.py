"""Servidor de arquivos estáticos para desenvolvimento local. Sem dependências."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
try:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), handler)
except OSError:
    print("A porta 8000 está ocupada. Feche o servidor anterior e tente novamente.")
    raise SystemExit(1)

print("Controle de Materiais: http://127.0.0.1:8000")
print("Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.")
webbrowser.open("http://127.0.0.1:8000")
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
